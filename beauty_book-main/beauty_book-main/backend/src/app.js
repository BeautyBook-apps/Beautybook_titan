import './config/env.js';
import express from 'express';
import cors from 'cors';
import { missingConfiguration } from './config/env.js';
import { securityHeaders, corsOptions, rateLimit } from './middleware/security.js';
import { requireAuth, requirePermission, withUserDatabase } from './middleware/auth.js';
import { asyncRoute, assert, HttpError, errorHandler } from './lib/errors.js';
import { userSupabase, getSupabaseAdmin } from './config/supabase.js';
import db from './config/pg.js';
import { createBooking, getAvailability, updateBooking } from './services/booking.js';
import { adminEntity, resourceAccess } from './services/admin.js';
import { sellerOverview, saveProduct, adjustInventory, fulfillOrder, requireSellerAccount, applySeller } from './services/seller.js';
import { mariaConversation, confirmBooking,confirmAction } from './services/maria.js';
import {receptionist} from './services/receptionist.js';
import { generateText, extractText, generateSpeech, transcribe, checkedImage } from './services/openai.js';
import { bookingCheckout, verifyStripeEvent, handleStripeEvent } from './services/payments.js';
import { approveProfessional,updateMembership,adminStats } from './services/admin-operations.js';
import {commerce} from './services/commerce.js';
import {sellerPayments} from './services/seller-payments.js';
import {partnerCheckout} from './services/partner-commerce.js';
import {imageJobs} from './services/image-jobs.js';
import {imageSearch} from './services/image-search.js';
import {inspectSchema} from './services/readiness.js';
import contentRoutes from './routes/content.routes.js';
import mapsRoutes from './routes/maps.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(cors(corsOptions()));
  app.post('/api/webhooks/stripe',express.raw({type:'application/json',limit:'1mb'}),asyncRoute(async(req,res)=>{
    const event=verifyStripeEvent(req.body,req.headers['stripe-signature']);
    const orderEvent=event.type.startsWith('checkout.session.')&&event.data.object.metadata?.order_id;
    res.json(await (orderEvent?commerce.handleEvent(event):handleStripeEvent(event)));
  }));
  app.use(express.json({ limit: '12mb' }));
  app.get('/api/health', (req,res) => res.json({ status:'ok', configured: missingConfiguration().length === 0 }));
  app.get('/api/ready', asyncRoute(async (req,res) => {
    assert(!missingConfiguration().length,503,'BACKEND_NOT_CONFIGURED','Le backend doit être configuré.');
    assert((await inspectSchema()).ready,503,'MIGRATIONS_REQUIRED','Les migrations BeautyBook doivent être appliquées.');
    res.json({status:'ready'});
  }));
  app.use('/api',rateLimit({max:180}));
  const authRate=rateLimit({max:12});

  // Public catalogue content is read with the server-side Supabase client so
  // published immobilier listings remain visible when public RLS reads are restricted.
  app.use('/api/content', contentRoutes);
  // Reverse geocoding used by the location picker must remain public: the
  // visitor can choose a city before being authenticated.
  app.use('/api/maps', mapsRoutes);

  app.post('/api/auth/admin/register',(req,res)=>res.status(403).json({error:'Les administrateurs sont habilités par un responsable autorisé.',code:'ADMIN_INVITATION_REQUIRED'}));
  app.post('/api/auth/admin/login',authRate,asyncRoute(async(req,res)=>{
    const {email,password}=req.body;
    assert(typeof email==='string' && typeof password==='string',400,'CREDENTIALS_REQUIRED','Email et mot de passe requis.');
    const client=userSupabase();
    const {data,error}=await client.auth.signInWithPassword({email,password});
    assert(!error && data?.session,401,'INVALID_CREDENTIALS','Identifiants invalides.');
    const {rows}=await db.query('SELECT active FROM public.bb_admin_memberships WHERE user_id=$1',[data.user.id]);
    assert(rows[0]?.active,403,'ADMIN_FORBIDDEN','Accès administrateur refusé.');
    res.json({success:true,session:data.session,user:data.user});
  }));

  app.use('/api',requireAuth);
  app.get('/api/cart',asyncRoute(async(req,res)=>res.json(await commerce.cart(req.user))));
  app.post('/api/cart',asyncRoute(async(req,res)=>res.json(await commerce.cart(req.user,req.body))));
  app.post('/api/commerce/quote',asyncRoute(async(req,res)=>res.json(await commerce.getQuote(req.body))));
  app.post('/api/commerce/partner-checkout',asyncRoute(async(req,res)=>res.json(await partnerCheckout(req.user,req.body))));
  app.post('/api/payments/checkout-session',asyncRoute(async(req,res)=>res.json(await commerce.checkout(req.user,req.body,req.headers['idempotency-key']))));
  app.get('/api/commandes/:id',asyncRoute(async(req,res)=>res.json(await commerce.orderDetail(req.user,req.params.id))));
  app.post('/api/commandes/:id/refund',asyncRoute(async(req,res)=>res.json(await commerce.requestRefund(req.user,req.params.id))));
  app.post('/api/admin/commandes/:id/refund',requirePermission('orders:write'),asyncRoute(async(req,res)=>res.json(await commerce.requestRefund(req.user,req.params.id,{admin:true,requestId:req.requestId}))));
  app.post('/api/payments/booking-checkout',asyncRoute(async(req,res)=>res.json(await bookingCheckout(req.user,req.body.reservation_id))));
  app.get('/api/capabilities',(req,res)=>res.json({
    ai:Boolean(process.env.OPENAI_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY),speech:Boolean(process.env.OPENAI_API_KEY),images:Boolean(process.env.OPENAI_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY),
    phone:false,
    social:false,
    payments:Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.APP_URL),
  }));

  app.get('/api/admin/session',requirePermission(),(req,res)=>res.json({user_id:req.user.id,...req.admin}));
  app.get('/api/admin/stats',requirePermission('operations:read'),asyncRoute(async(req,res)=>res.json(await adminStats())));
  app.put('/api/admin/reservations/:id',requirePermission('bookings:write'),asyncRoute(async(req,res)=>res.json({reservation:await updateBooking(req.user,req.params.id,req.body,{admin:true,requestId:req.requestId})})));
  app.get('/api/admin/memberships',requirePermission('access:write'),asyncRoute(async(req,res)=>res.json({memberships:(await db.query('SELECT user_id,role,active,permissions FROM public.bb_admin_memberships')).rows})));
  app.put('/api/admin/memberships/:id',requirePermission('access:write'),asyncRoute(async(req,res)=>res.json({membership:await updateMembership(req.user,req.params.id,req.body,req.requestId)})));
  app.post('/api/admin/professionals/:id/review',requirePermission('professionals:write'),asyncRoute(async(req,res)=>res.json({application:await approveProfessional(req.user,req.params.id,req.body,req.requestId)})));
  app.post('/api/admin/private-document',requirePermission('professionals:read'),asyncRoute(async(req,res)=>{
    assert(typeof req.body.path==='string' && /^storage:\/\/private-documents\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(pdf|jpg|png|webp)$/.test(req.body.path),400,'INVALID_DOCUMENT','Référence de document invalide.');
    const path=req.body.path.replace('storage://private-documents/','');
    const {data,error}=await getSupabaseAdmin().storage.from('private-documents').createSignedUrl(path,60);
    assert(!error && data?.signedUrl,502,'DOCUMENT_UNAVAILABLE','Le document n’a pas pu être ouvert.');
    await db.query('INSERT INTO public.bb_audit_log(actor_id,action,resource,resource_id,request_id) VALUES($1,$2,$3,$4,$5)',[req.user.id,'document.read','private-documents',path,req.requestId]);
    res.json({url:data.signedUrl});
  }));
  app.post('/api/admin/entities',(req,res,next)=>{
    try { const access=resourceAccess(req.body.table,req.body.operation || 'list'); requirePermission(access.permission)(req,res,next); }
    catch(error){next(error);}
  },asyncRoute(async(req,res)=>res.json({result:await adminEntity(req.user,req.body,req.requestId)})));
  app.get('/api/admin/health',requirePermission('operations:read'),asyncRoute(async(req,res)=>{
    const started=Date.now(); await db.query('SELECT 1');
    const {rows}=await db.query('SELECT status,count(*)::integer AS count FROM public.bb_outbox GROUP BY status');
    res.json({database:{ok:true,latency_ms:Date.now()-started},outbox:rows,integrations:{openai:!!process.env.OPENAI_API_KEY,grok:!!(process.env.XAI_API_KEY || process.env.GROK_API_KEY),fal:!!process.env.FAL_KEY,twilio:!!process.env.TWILIO_AUTH_TOKEN,meta:!!process.env.META_APP_SECRET}});
  }));

  app.get('/api/seller/overview',asyncRoute(async(req,res)=>res.json(await sellerOverview(req.user))));
  app.get('/api/seller/payments',asyncRoute(async(req,res)=>res.json(await sellerPayments.status(req.user))));
  app.post('/api/seller/payments/onboarding',asyncRoute(async(req,res)=>res.json(await sellerPayments.onboarding(req.user,req.body))));
  app.post('/api/seller/payments/dashboard',asyncRoute(async(req,res)=>res.json(await sellerPayments.dashboard(req.user))));
  app.put('/api/seller/shipping',asyncRoute(async(req,res)=>res.json(await sellerPayments.shipping(req.user,req.body))));
  app.post('/api/seller/apply',asyncRoute(async(req,res)=>res.json({account:await applySeller(req.user,req.body)})));
  app.post('/api/seller/products',asyncRoute(async(req,res)=>res.status(201).json({product:await saveProduct(req.user,req.body)})));
  app.put('/api/seller/products/:id',asyncRoute(async(req,res)=>res.json({product:await saveProduct(req.user,req.body,req.params.id)})));
  app.post('/api/seller/products/:id/stock',asyncRoute(async(req,res)=>res.json({movement:await adjustInventory(req.user,req.params.id,req.body,req.headers['idempotency-key'])})));
  app.put('/api/seller/orders/:id',asyncRoute(async(req,res)=>res.json({order:await fulfillOrder(req.user,req.params.id,req.body)})));
  app.put('/api/seller/settings',asyncRoute(async(req,res)=>{
    await requireSellerAccount(req.user);
    const {shop_name,low_stock_threshold}=req.body;
    assert(typeof shop_name==='string' && shop_name.trim().length>=2 && Number.isInteger(low_stock_threshold) && low_stock_threshold>=0,400,'INVALID_SETTINGS','Nom de boutique ou seuil de stock invalide.');
    const {rows}=await db.query('UPDATE public.bb_seller_accounts SET shop_name=$1,low_stock_threshold=$2,updated_at=now() WHERE user_id=$3 RETURNING shop_name,low_stock_threshold',[shop_name.trim().slice(0,120),low_stock_threshold,req.user.id]);
    res.json({settings:rows[0]});
  }));

  app.post('/api/reservations/availability',asyncRoute(async(req,res)=>res.json(await getAvailability(req.body))));
  app.post('/api/reservations',asyncRoute(async(req,res)=>res.status(201).json({success:true,reservation:await createBooking(req.user,req.body,{channel:'app',idempotencyKey:req.headers['idempotency-key']})})));
  app.put('/api/reservations/:id',asyncRoute(async(req,res)=>res.json({success:true,reservation:await updateBooking(req.user,req.params.id,req.body)})));
  app.post('/api/reservations/complete',asyncRoute(async(req,res)=>res.json({success:true,reservation:await updateBooking(req.user,req.body.reservation_id,{status:'termine'})})));
  app.post('/api/reservations/list',asyncRoute(async(req,res)=>{
    const {rows}=await db.query('SELECT * FROM public."Reservation" WHERE client_id=$1 OR client_email=$2 OR pro_email=$2 ORDER BY date DESC LIMIT 200',[req.user.id,req.user.email]);
    res.json({reservations:rows});
  }));

  app.use('/api/ai',rateLimit({max:20}));
  app.post('/api/ai/image-search',asyncRoute(async(req,res)=>res.json(await imageSearch(req.body))));
  app.post(['/api/ai/try-on','/api/ai/simulate-hairstyle'],asyncRoute(async(req,res)=>res.status(202).json(await imageJobs.create(req.user,req.path.endsWith('simulate-hairstyle')?{...req.body,mode:'hair'}:req.body,req.headers['idempotency-key']))));
  app.get('/api/image-jobs',asyncRoute(async(req,res)=>res.json(await imageJobs.list(req.user))));
  app.get('/api/image-jobs/:id',asyncRoute(async(req,res)=>res.json(await imageJobs.get(req.user,req.params.id))));
  app.delete('/api/image-jobs/:id',asyncRoute(async(req,res)=>res.json(await imageJobs.remove(req.user,req.params.id))));
  app.get('/api/pro/receptionist',asyncRoute(async(req,res)=>res.json(await receptionist.overview(req.user))));
  app.put('/api/pro/receptionist',asyncRoute(async(req,res)=>res.json({settings:await receptionist.settings(req.user,req.body)})));
  app.put('/api/pro/leads/:id',asyncRoute(async(req,res)=>res.json(await receptionist.updateRequest(req.user,'lead',req.params.id,req.body.status))));
  app.put('/api/pro/handoffs/:id',asyncRoute(async(req,res)=>res.json(await receptionist.updateRequest(req.user,'handoff',req.params.id,req.body.status))));
  app.post('/api/ai/confirm-action',asyncRoute(async(req,res)=>res.json(await confirmAction(req.user,req.body.id))));
  app.post('/api/ai/maria',asyncRoute(async(req,res)=>res.json(await mariaConversation(req.user,req.body))));
  app.post('/api/ai/confirm-booking',asyncRoute(async(req,res)=>res.json({success:true,reservation:await confirmBooking(req.user,req.body.id)})));
  app.post(['/api/ai/tts','/api/ai/voicebox-speak'],asyncRoute(async(req,res)=>{
    const audio=await generateSpeech(req.body.text);
    assert(audio.length>0,502,'EMPTY_AUDIO','La synthèse vocale n’a pas produit de son.');
    res.type('audio/mpeg').send(audio);
  }));
  app.get('/api/ai/voicebox-status',(req,res)=>res.json({available:!!process.env.OPENAI_API_KEY,provider:'openai',voice:process.env.OPENAI_TTS_VOICE || 'coral'}));
  app.post('/api/ai/transcribe',asyncRoute(async(req,res)=>res.json(await transcribe(req.body))));
  app.post('/api/ai/invoke-llm',asyncRoute(async(req,res)=>{
    const {prompt,response_json_schema,file_urls=[]}=req.body;
    assert(typeof prompt==='string' && prompt.length>0 && prompt.length<=16000 && Array.isArray(file_urls) && file_urls.length<=4,400,'INVALID_PROMPT','Demande IA invalide.');
    const text=prompt+(response_json_schema ? '\nRéponds uniquement en JSON suivant ce schéma : '+JSON.stringify(response_json_schema) : '');
    const response=await generateText({input:[{role:'user',content:[{type:'input_text',text},...file_urls.map(url=>({type:'input_image',image_url:checkedImage(url)}))]}],instructions:'Assistant BeautyBook. Réponds à partir des informations fournies. N’invente aucun résultat d’action, tarif, rendez-vous ou disponibilité. Aucune action externe ne peut être effectuée par cette requête.'});
    const content=extractText(response);
    assert(content,502,'EMPTY_AI_RESPONSE','L’IA n’a pas renvoyé de résultat.');
    let result={content};
    if(response_json_schema){try{result=JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{throw new HttpError(502,'INVALID_AI_RESULT','L’IA a renvoyé un résultat inexploitable. Réessayez.');}}
    res.json({result});
  }));
  app.post('/api/ai/analyze-photo',asyncRoute(async(req,res)=>{
    const response=await generateText({input:[{role:'user',content:[{type:'input_image',image_url:checkedImage(req.body.photoUrl)},{type:'input_text',text:'Analyse uniquement la qualité du cadrage pour un essayage virtuel, sans inventer de score. JSON: {"has_person":boolean,"body_visible":boolean,"quality_ok":boolean,"issues":string[],"suggestion":string}. Ne déduis pas de caractéristique sensible.'}]}]});
    let result;
    try{result=JSON.parse(extractText(response).replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{throw new HttpError(502,'INVALID_AI_RESULT','Analyse inexploitable.');}
    assert(['has_person','body_visible','quality_ok'].every(k=>typeof result[k]==='boolean') && Array.isArray(result.issues),502,'INVALID_AI_RESULT','Analyse inexploitable.');
    res.json(result);
  }));

  // RLS-bound compatibility API: no service role, no SQL endpoint, no automatic migrations.
  const tables=new Set(['ProfilPro','Service','Avis','Style','Reel','CommentaireStyle','MessageChat','Notification','Produit','Annonce','AppConfig','CallLog','CallSignal','CatalogueOption','DemandeProV2','DemandefFranchise','ImmobilierListing','LiveMessage','LiveSession','MariaConversation','MembreEquipe','Publication','Repub','RoutineBeaute','Panier','UserMemory','VisiteVirtuelle','ServiceBundle','profiles','user_like','reel_comment','reel_comment_report','user_follow','user_favorite']);
  app.post('/api/crud/:operation',withUserDatabase,asyncRoute(async(req,res)=>{
    const {operation}=req.params; const {table,data={},id,filters={},limit=100,orderBy='-created_at'}=req.body;
    assert(tables.has(table) && ['create','update','delete','filter','list'].includes(operation),404,'RESOURCE_UNKNOWN','Opération indisponible.');
    assert(!['role','email','id','created_by_id','owner_id','seller_user_id','payment_status','stripe_customer_id'].some(key=>key in data),403,'PROTECTED_FIELD','Un champ protégé ne peut pas être modifié.');
    let query=req.db.from(table);
    if(operation==='create') query=query.insert(data).select().single();
    else if(operation==='update') query=query.update(data).eq('id',id).select().single();
    else if(operation==='delete') query=query.delete().eq('id',id).select('id').single();
    else{
      query=query.select('*').limit(Math.min(Number(limit)||100,500));
      for(const [key,value] of Object.entries(filters)) query=query.eq(key,value);
      query=query.order(orderBy.replace(/^-/,'').replace('created_date','created_at'),{ascending:!orderBy.startsWith('-')});
    }
    const result=await query;
    assert(!result.error,400,'DATA_OPERATION_REJECTED','L’opération a été refusée. Vérifiez les données et vos permissions.');
    res.json({result:result.data});
  }));

  app.use((req,res)=>res.status(404).json({error:'Cette opération n’est pas disponible.',code:'ENDPOINT_NOT_FOUND'}));
  app.use(errorHandler);
  return app;
}
