import db from '../config/pg.js';
import {assert} from '../lib/errors.js';
import {stripeClient,applicationUrl} from './payments-provider.js';

export const AI_CREDIT_PACKAGES = Object.freeze({
  starter: {id:'starter',name:'Pack Découverte',credits:10,amount_cents:499,highlight:false},
  studio: {id:'studio',name:'Pack Studio',credits:30,amount_cents:999,highlight:true},
  creator: {id:'creator',name:'Pack Créateur',credits:100,amount_cents:2499,highlight:false},
});

const requestKeyPattern=/^[A-Za-z0-9_-]{16,100}$/;
const fallbackPackages=Object.values(AI_CREDIT_PACKAGES);
function packageRow(row){
 return {id:String(row.id),name:String(row.name),credits:Number(row.credits),amount_cents:Number(row.amount_cents),highlight:Boolean(row.highlight),active:row.active!==false,display_order:Number(row.display_order||0)};
}
async function configFor(client,fallbackFreeLimit=5){
 const {rows:[settings]}=await client.query('SELECT free_daily_limit,provider_cost_cents FROM public.bb_ai_credit_settings WHERE id=true');
 const {rows}=await client.query('SELECT id,name,credits,amount_cents,highlight,active,display_order FROM public.bb_ai_credit_packages WHERE active=true ORDER BY display_order,id');
 const free=Number(settings?.free_daily_limit||fallbackFreeLimit);
 return {
  freeDailyLimit:Number.isInteger(free)&&free>0?free:5,
  providerCostCents:Math.max(0,Number(settings?.provider_cost_cents||0)),
  packages:rows.length?rows.map(packageRow):fallbackPackages,
 };
}

async function ensureWallet(client,userId){
 await client.query('INSERT INTO public.bb_ai_credit_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING',[userId]);
 const {rows:[wallet]}=await client.query('SELECT * FROM public.bb_ai_credit_wallets WHERE user_id=$1 FOR UPDATE',[userId]);
 assert(wallet,503,'AI_CREDITS_NOT_READY','Le portefeuille IA n’est pas disponible.');
 return wallet;
}

export function createAICreditsService(database=db,{getStripe=stripeClient,getAppUrl=applicationUrl}={}){
 async function summary(userId,freeLimit=5){
  return database.transaction(async client=>{
   const wallet=await ensureWallet(client,userId);
   const config=await configFor(client,freeLimit);
   const {rows:[usage]}=await client.query("SELECT count(*)::integer AS used FROM public.bb_image_jobs WHERE user_id=$1 AND billing_source='free' AND billing_refunded_at IS NULL AND created_at>=date_trunc('day',now())",[userId]);
   return {
    credits:Number(wallet.balance),
    free_limit:config.freeDailyLimit,
    free_used:Number(usage?.used||0),
    free_remaining:Math.max(0,config.freeDailyLimit-Number(usage?.used||0)),
    packages:config.packages,
   };
  });
 }

 async function freeLimit(client,fallback=5){
  return (await configFor(client,fallback)).freeDailyLimit;
 }

 // Called inside the image-job transaction. It reserves exactly one unit of
 // usage, preferring the daily free allowance and then paid credits.
 async function reserve(client,userId,freeLimit){
  const wallet=await ensureWallet(client,userId);
  const config=await configFor(client,freeLimit);
  const {rows:[usage]}=await client.query("SELECT count(*)::integer AS used FROM public.bb_image_jobs WHERE user_id=$1 AND billing_source='free' AND billing_refunded_at IS NULL AND created_at>=date_trunc('day',now())",[userId]);
  if(Number(usage?.used||0)<config.freeDailyLimit)return {source:'free',credit_cost:0,credits_remaining:Number(wallet.balance)};
  assert(Number(wallet.balance)>0,429,'AI_QUOTA_REACHED',`Vous avez utilisé vos ${config.freeDailyLimit} générations gratuites aujourd’hui. Achetez des crédits pour continuer.`);
  const next=Number(wallet.balance)-1;
  await client.query('UPDATE public.bb_ai_credit_wallets SET balance=$1,updated_at=now() WHERE user_id=$2',[next,userId]);
  return {source:'credits',credit_cost:1,credits_remaining:next};
 }

 async function recordGeneration(client,userId,jobId,reservation){
  if(reservation.source!=='credits')return;
  await client.query('INSERT INTO public.bb_ai_credit_ledger(user_id,delta,balance_after,reason,image_job_id,metadata) VALUES($1,-1,$2,\'generation\',$3,$4::jsonb)',[userId,reservation.credits_remaining,jobId,JSON.stringify({source:'paid_credit'})]);
 }

 async function refundGeneration(client,row){
  if(row.billing_refunded_at)return false;
  if(row.billing_source==='credits'){
   const wallet=await ensureWallet(client,row.user_id);
   const next=Number(wallet.balance)+Math.max(1,Number(row.credit_cost)||1);
   await client.query('UPDATE public.bb_ai_credit_wallets SET balance=$1,updated_at=now() WHERE user_id=$2',[next,row.user_id]);
   await client.query('INSERT INTO public.bb_ai_credit_ledger(user_id,delta,balance_after,reason,image_job_id,metadata) VALUES($1,$2,$3,\'generation_refund\',$4,$5::jsonb)',[row.user_id,Math.max(1,Number(row.credit_cost)||1),next,row.id,JSON.stringify({reason:'definitive_generation_failure'})]);
  }
  await client.query('UPDATE public.bb_image_jobs SET billing_refunded_at=now() WHERE id=$1 AND billing_refunded_at IS NULL',[row.id]);
  return true;
 }

 async function checkout(user,packageId,requestKey,returnPath='/sh-ai'){
  assert(user?.id,401,'AUTH_REQUIRED','Connectez-vous pour acheter des crédits.');
  assert(typeof requestKey==='string'&&requestKeyPattern.test(requestKey),400,'IDEMPOTENCY_REQUIRED','Identifiant de paiement manquant.');
  const {rows:[storedPackage]}=await database.query('SELECT id,name,credits,amount_cents,highlight,active,display_order FROM public.bb_ai_credit_packages WHERE id=$1 AND active=true',[String(packageId||'')]);
  const pkg=storedPackage?packageRow(storedPackage):null;
  assert(pkg,400,'AI_CREDIT_PACKAGE_INVALID','Pack de crédits invalide.');
  const stripe=getStripe(),app=getAppUrl();
  const safeReturnPath=['/sh-ai','/maria'].includes(returnPath)?returnPath:'/sh-ai';
  const {rows:[existing]}=await database.query('SELECT checkout_url,stripe_session_id,status FROM public.bb_ai_credit_purchases WHERE user_id=$1 AND request_key=$2',[user.id,requestKey]);
  if(existing?.checkout_url&&['pending','paid'].includes(existing.status))return {checkout_url:existing.checkout_url,session_id:existing.stripe_session_id};
  const session=await stripe.checkout.sessions.create({
   mode:'payment',payment_method_types:['card','link'],customer_email:user.email,client_reference_id:user.id,
   line_items:[{price_data:{currency:'eur',unit_amount:pkg.amount_cents,product_data:{name:`${pkg.name} · ${pkg.credits} crédits IA`,description:'Crédits utilisables pour les simulations BeautyBook'}},quantity:1}],
   metadata:{type:'ai_credits',user_id:user.id,request_key:requestKey,package_id:pkg.id,credits:String(pkg.credits),amount_cents:String(pkg.amount_cents)},
   success_url:app+safeReturnPath+'?credits=success',cancel_url:app+safeReturnPath+'?credits=cancelled',
  },{idempotencyKey:'ai-credits-'+user.id+'-'+requestKey});
  assert(session.id&&session.url,502,'CHECKOUT_FAILED','La page de paiement n’a pas pu être créée.');
  await database.query(`INSERT INTO public.bb_ai_credit_purchases(user_id,request_key,stripe_session_id,checkout_url,package_id,credits,amount_cents)
   VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(request_key) DO UPDATE SET stripe_session_id=EXCLUDED.stripe_session_id,checkout_url=EXCLUDED.checkout_url,updated_at=now()`,[user.id,requestKey,session.id,session.url,pkg.id,pkg.credits,pkg.amount_cents]);
  return {checkout_url:session.url,session_id:session.id,package:pkg};
 }

 async function handleEvent(event){
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired'].includes(event.type))return null;
  const session=event.data.object,metadata=session.metadata||{};
  if(metadata.type!=='ai_credits')return null;
  return database.transaction(async client=>{
   const {rows:[events]}=await client.query('INSERT INTO public.bb_webhook_events(provider,event_id,event_type) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id',['stripe',event.id,event.type]);
   if(!events)return {received:true,duplicate:true};
   const {rows:[purchase]}=await client.query('SELECT * FROM public.bb_ai_credit_purchases WHERE stripe_session_id=$1 OR request_key=$2 FOR UPDATE',[session.id,metadata.request_key||'']);
   if(!purchase)return {received:true};
   if(event.type==='checkout.session.expired'){
    if(purchase.status==='pending')await client.query("UPDATE public.bb_ai_credit_purchases SET status='expired',updated_at=now() WHERE id=$1",[purchase.id]);
    return {received:true};
   }
   if(session.payment_status!=='paid')return {received:true};
   assert(session.currency=== 'eur'&&session.amount_total===Number(purchase.amount_cents)&&session.client_reference_id===purchase.user_id&&metadata.package_id===purchase.package_id,409,'PAYMENT_MISMATCH','Le paiement de crédits ne correspond pas à la commande.');
   if(purchase.status==='paid')return {received:true,duplicate:true};
   const wallet=await ensureWallet(client,purchase.user_id);
   const next=Number(wallet.balance)+Number(purchase.credits);
   await client.query('UPDATE public.bb_ai_credit_wallets SET balance=$1,updated_at=now() WHERE user_id=$2',[next,purchase.user_id]);
   await client.query('INSERT INTO public.bb_ai_credit_ledger(user_id,delta,balance_after,reason,stripe_session_id,metadata) VALUES($1,$2,$3,\'purchase\',$4,$5::jsonb)',[purchase.user_id,purchase.credits,next,session.id,JSON.stringify({package_id:purchase.package_id,amount_cents:purchase.amount_cents})]);
   await client.query("UPDATE public.bb_ai_credit_purchases SET status='paid',stripe_payment_intent_id=$1,updated_at=now() WHERE id=$2",[session.payment_intent,purchase.id]);
   return {received:true,credits_added:Number(purchase.credits),balance:next};
  });
 }

 async function buildAdminOverview(client){
  const config=await configFor(client,5);
  const {rows:[totals]}=await client.query(`SELECT
    count(*) FILTER(WHERE status<>'deleted' AND billing_refunded_at IS NULL)::integer AS total_generations,
    count(*) FILTER(WHERE billing_source='free' AND status<>'deleted' AND billing_refunded_at IS NULL)::integer AS free_generations,
    count(*) FILTER(WHERE billing_source='credits' AND status<>'deleted' AND billing_refunded_at IS NULL)::integer AS paid_generations,
    count(DISTINCT user_id) FILTER(WHERE status<>'deleted')::integer AS active_users,
    count(*) FILTER(WHERE status='failed')::integer AS failed_generations
    FROM public.bb_image_jobs WHERE created_at>=now()-interval '30 days'`);
  const {rows:[finance]}=await client.query(`SELECT
    coalesce((SELECT sum(amount_cents) FROM public.bb_ai_credit_purchases WHERE status='paid' AND created_at>=now()-interval '30 days'),0)::bigint AS revenue_cents,
    coalesce((SELECT count(*) FROM public.bb_ai_credit_purchases WHERE status='paid' AND created_at>=now()-interval '30 days'),0)::integer AS paid_purchases`);
  const {rows:daily}=await client.query(`WITH days AS (
    SELECT generate_series(current_date-interval '29 days',current_date,interval '1 day')::date AS day
  ), jobs AS (
    SELECT created_at::date AS day,
      count(*) FILTER(WHERE billing_source='free' AND billing_refunded_at IS NULL AND status<>'deleted')::integer AS free_generations,
      count(*) FILTER(WHERE billing_source='credits' AND billing_refunded_at IS NULL AND status<>'deleted')::integer AS paid_generations,
      count(DISTINCT user_id)::integer AS active_users
    FROM public.bb_image_jobs WHERE created_at>=current_date-interval '29 days' GROUP BY created_at::date
  ), sales AS (
    SELECT created_at::date AS day,count(*)::integer AS purchases,coalesce(sum(amount_cents),0)::bigint AS revenue_cents
    FROM public.bb_ai_credit_purchases WHERE status='paid' AND created_at>=current_date-interval '29 days' GROUP BY created_at::date
  ) SELECT days.day::text,coalesce(jobs.free_generations,0)::integer AS free_generations,coalesce(jobs.paid_generations,0)::integer AS paid_generations,coalesce(jobs.active_users,0)::integer AS active_users,coalesce(sales.purchases,0)::integer AS purchases,coalesce(sales.revenue_cents,0)::bigint AS revenue_cents
    FROM days LEFT JOIN jobs USING(day) LEFT JOIN sales USING(day) ORDER BY days.day`);
  const {rows:packageStats}=await client.query(`SELECT package_id,count(*)::integer AS purchases,coalesce(sum(credits),0)::integer AS credits_sold,coalesce(sum(amount_cents),0)::bigint AS revenue_cents
    FROM public.bb_ai_credit_purchases WHERE status='paid' GROUP BY package_id ORDER BY revenue_cents DESC`);
  const dailySeries=daily.map(row=>{
   const generations=Number(row.free_generations)+Number(row.paid_generations);
   const revenue=Number(row.revenue_cents);
   const cost=generations*config.providerCostCents;
   return {...row,free_generations:Number(row.free_generations),paid_generations:Number(row.paid_generations),active_users:Number(row.active_users),purchases:Number(row.purchases),revenue_cents:revenue,cost_cents:cost,profit_cents:revenue-cost};
  });
  const revenueCents=Number(finance.revenue_cents||0);
  const costCents=dailySeries.reduce((sum,row)=>sum+row.cost_cents,0);
  return {
   settings:{free_daily_limit:config.freeDailyLimit,provider_cost_cents:config.providerCostCents},
   packages:config.packages,
   kpis:{...totals,total_generations:Number(totals.total_generations||0),free_generations:Number(totals.free_generations||0),paid_generations:Number(totals.paid_generations||0),active_users:Number(totals.active_users||0),failed_generations:Number(totals.failed_generations||0),revenue_cents:revenueCents,paid_purchases:Number(finance.paid_purchases||0),estimated_cost_cents:costCents,estimated_profit_cents:revenueCents-costCents},
   daily:dailySeries,
   package_stats:packageStats.map(row=>({...row,purchases:Number(row.purchases),credits_sold:Number(row.credits_sold),revenue_cents:Number(row.revenue_cents)})),
  };
 }

 async function adminOverview(){
  return database.transaction(client=>buildAdminOverview(client));
 }

 async function updateAdminConfig(userId,input,requestId){
  assert(input&&typeof input==='object'&&!Array.isArray(input),400,'AI_CREDIT_CONFIG_INVALID','Configuration IA invalide.');
  const settings=input.settings||{};
  const freeDailyLimit=Number(settings.free_daily_limit),providerCostCents=Number(settings.provider_cost_cents);
  assert(Number.isInteger(freeDailyLimit)&&freeDailyLimit>=1&&freeDailyLimit<=100,400,'AI_CREDIT_CONFIG_INVALID','Le quota gratuit doit être compris entre 1 et 100.');
  assert(Number.isInteger(providerCostCents)&&providerCostCents>=0&&providerCostCents<=100000,400,'AI_CREDIT_CONFIG_INVALID','Le coût fournisseur est invalide.');
  assert(Array.isArray(input.packages)&&input.packages.length>=1&&input.packages.length<=12,400,'AI_CREDIT_CONFIG_INVALID','Ajoutez au moins un pack de crédits.');
  const packages=input.packages.map((row,index)=>{
   const id=String(row.id||'').trim(),name=String(row.name||'').trim(),credits=Number(row.credits),amountCents=Number(row.amount_cents);
   assert(/^[a-z][a-z0-9_-]{1,40}$/.test(id)&&name.length>=2&&name.length<=80&&Number.isInteger(credits)&&credits>0&&credits<=100000&&Number.isInteger(amountCents)&&amountCents>=50&&amountCents<=1000000,400,'AI_CREDIT_CONFIG_INVALID','Un pack contient des valeurs invalides.');
   return {id,name,credits,amount_cents:amountCents,highlight:Boolean(row.highlight),active:row.active!==false,display_order:Number.isInteger(Number(row.display_order))?Number(row.display_order):index+1};
  });
  assert(new Set(packages.map(row=>row.id)).size===packages.length,400,'AI_CREDIT_CONFIG_INVALID','Les identifiants de packs doivent être uniques.');
  return database.transaction(async client=>{
   await client.query('INSERT INTO public.bb_ai_credit_settings(id,free_daily_limit,provider_cost_cents,updated_by) VALUES(true,$1,$2,$3) ON CONFLICT(id) DO UPDATE SET free_daily_limit=EXCLUDED.free_daily_limit,provider_cost_cents=EXCLUDED.provider_cost_cents,updated_by=EXCLUDED.updated_by,updated_at=now()',[freeDailyLimit,providerCostCents,userId]);
   for(const row of packages)await client.query('INSERT INTO public.bb_ai_credit_packages(id,name,credits,amount_cents,highlight,active,display_order) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,credits=EXCLUDED.credits,amount_cents=EXCLUDED.amount_cents,highlight=EXCLUDED.highlight,active=EXCLUDED.active,display_order=EXCLUDED.display_order,updated_at=now()',[row.id,row.name,row.credits,row.amount_cents,row.highlight,row.active,row.display_order]);
   if(requestId)await client.query('INSERT INTO public.bb_audit_log(actor_id,action,resource,resource_id,changes,request_id) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[userId,'ai-credits.configure','bb_ai_credit_packages','settings',JSON.stringify({free_daily_limit:freeDailyLimit,provider_cost_cents:providerCostCents,packages}),requestId]);
   return buildAdminOverview(client);
  });
 }

 return {summary,freeLimit,reserve,recordGeneration,refundGeneration,checkout,handleEvent,adminOverview,updateAdminConfig};
}

export const aiCredits=createAICreditsService();
