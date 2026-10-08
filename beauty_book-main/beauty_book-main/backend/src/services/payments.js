import Stripe from 'stripe';
import db from '../config/pg.js';
import {assert,HttpError} from '../lib/errors.js';

function stripeClient(){
 assert(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET,503,'PAYMENTS_NOT_CONFIGURED','Le paiement en ligne n’est pas encore disponible.');
 return new Stripe(process.env.STRIPE_SECRET_KEY,{timeout:20000,maxNetworkRetries:1});
}
function applicationUrl(){
 assert(process.env.APP_URL,503,'APP_URL_REQUIRED','L’adresse de retour de paiement doit être configurée.');
 const url=new URL(process.env.APP_URL);
 assert(url.protocol==='https:' || (process.env.NODE_ENV!=='production' && ['localhost','127.0.0.1'].includes(url.hostname)),503,'APP_URL_INVALID','Adresse de retour de paiement invalide.');
 return url.origin;
}
export function verifyStripeEvent(raw,signature){
 const stripe=stripeClient();
 try{return stripe.webhooks.constructEvent(raw,signature,process.env.STRIPE_WEBHOOK_SECRET);}catch{throw new HttpError(400,'INVALID_WEBHOOK_SIGNATURE','Signature de paiement invalide.');}
}
export function createPaymentService(database=db,getStripe=stripeClient,getAppUrl=applicationUrl){
 async function bookingCheckout(user,id){
  const stripe=getStripe();const app=getAppUrl();
  return database.transaction(async client=>{
   const {rows:[booking]}=await client.query('SELECT * FROM public."Reservation" WHERE id::text=$1 AND client_id=$2 FOR UPDATE',[id,user.id]);
   assert(booking,404,'BOOKING_NOT_FOUND','Rendez-vous introuvable.');
   assert(['en_attente','confirme'].includes(booking.status),409,'BOOKING_CLOSED','Ce rendez-vous ne peut plus être payé.');
   assert(!['paye','paid','acompte_paye'].includes(booking.payment_status),409,'ALREADY_PAID','Un paiement est déjà enregistré pour ce rendez-vous.');
   const {rows:[existing]}=await client.query('SELECT * FROM public.bb_payment_sessions WHERE reservation_id=$1',[booking.id]);
   if(existing?.stripe_session_id){
    assert(existing.status==='open',409,'PAYMENT_CLOSED','Cette session de paiement est terminée. Consultez votre rendez-vous.');
    return {url:existing.checkout_url,session_id:existing.stripe_session_id};
   }
   const amount=Math.round(Number(booking.total_price)*100);
   assert(Number.isSafeInteger(amount) && amount>=50,400,'INVALID_PAYMENT_AMOUNT','Le montant doit être supérieur ou égal à 0,50 €.');
   const session=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card','link'],customer_email:user.email,client_reference_id:user.id,
    line_items:[{price_data:{currency:'eur',unit_amount:amount,product_data:{name:booking.service_name.slice(0,200)}},quantity:1}],
    metadata:{reservation_id:booking.id,user_id:user.id},expires_at:Math.floor(Date.now()/1000)+1800,
    success_url:app+'/rendez-vous?payment=verification',cancel_url:app+'/rendez-vous?payment=cancelled',
   },{idempotencyKey:'booking-checkout-'+booking.id});
   assert(session.url && session.id,502,'CHECKOUT_FAILED','La page de paiement n’a pas pu être créée.');
   await client.query(`INSERT INTO public.bb_payment_sessions(reservation_id,user_id,stripe_session_id,checkout_url,amount_cents,status)
    VALUES($1,$2,$3,$4,$5,'open')`,[booking.id,user.id,session.id,session.url,amount]);
   await client.query(`UPDATE public."Reservation" SET payment_type='full',updated_at=now() WHERE id=$1`,[booking.id]);
   return {url:session.url,session_id:session.id};
  });
 }
 async function handleEvent(event){
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired'].includes(event.type))return {received:true};
  const session=event.data.object;
  return database.transaction(async client=>{
   const {rows:events}=await client.query('INSERT INTO public.bb_webhook_events(provider,event_id,event_type) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id',['stripe',event.id,event.type]);
   if(!events.length)return {received:true,duplicate:true};
   const {rows:[payment]}=await client.query('SELECT * FROM public.bb_payment_sessions WHERE stripe_session_id=$1 FOR UPDATE',[session.id]);
   // A provider account may handle several applications. Ignore unrelated sessions.
   if(!payment)return {received:true};
   const {rows:[booking]}=await client.query('SELECT * FROM public."Reservation" WHERE id=$1 FOR UPDATE',[payment.reservation_id]);
   if(event.type==='checkout.session.expired'){
    if(payment.status==='open'){
     await client.query("UPDATE public.bb_payment_sessions SET status='expired',updated_at=now() WHERE id=$1",[payment.id]);
     await client.query(`UPDATE public."Reservation" SET status='annule',updated_at=now() WHERE id=$1 AND payment_status='non_paye' AND status='en_attente'`,[booking.id]);
    }
    return {received:true};
   }
   if(session.payment_status!=='paid')return {received:true};
   assert(session.currency===payment.currency && session.amount_total===Number(payment.amount_cents) && session.metadata?.reservation_id===booking.id && session.client_reference_id===payment.user_id,409,'PAYMENT_MISMATCH','Le paiement ne correspond pas au rendez-vous.');
   if(['paid','refund_required','refunded'].includes(payment.status))return {received:true,duplicate:true};
   const cancelled=!['en_attente','confirme'].includes(booking.status);
   await client.query('UPDATE public.bb_payment_sessions SET status=$1,payment_intent_id=$2,updated_at=now() WHERE id=$3',[cancelled?'refund_required':'paid',session.payment_intent,payment.id]);
   if(!cancelled)await client.query(`UPDATE public."Reservation" SET payment_status='paye',updated_at=now() WHERE id=$1`,[booking.id]);
   await client.query('INSERT INTO public.bb_outbox(topic,aggregate_id,payload) VALUES($1,$2,$3::jsonb)',[cancelled?'payment.refund_required':'payment.confirmed',booking.id,JSON.stringify({payment_id:payment.id,reservation_id:booking.id})]);
   return {received:true};
  });
 }
 return {bookingCheckout,handleEvent};
}
export const {bookingCheckout,handleEvent:handleStripeEvent}=createPaymentService();
