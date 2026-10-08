import {createHash,randomUUID} from 'node:crypto';
import db from '../config/pg.js';
import {assert} from '../lib/errors.js';
import {stripeClient,applicationUrl} from './payments-provider.js';

const uuid=/^[a-f0-9-]{36}$/i;
const cents=value=>Math.round(Number(value)*100);
function commission(){
 const raw=process.env.MARKETPLACE_COMMISSION_BPS;
 assert(raw!==undefined&&raw!==''&&Number.isInteger(Number(raw))&&Number(raw)>=0&&Number(raw)<=10000,503,'COMMERCE_NOT_CONFIGURED','Les conditions de vente doivent être configurées.');
 return Number(raw);
}
export function normalizeItems(items){
 assert(Array.isArray(items)&&items.length>0&&items.length<=50,400,'INVALID_CART','Le panier doit contenir entre 1 et 50 produits.');
 const grouped=new Map();
 for(const item of items){
  const id=item.product_id||item.produit_id;
  assert(typeof id==='string'&&uuid.test(id)&&Number.isInteger(item.quantity)&&item.quantity>0&&item.quantity<=1000,400,'INVALID_CART_ITEM','Produit ou quantité invalide.');
  grouped.set(id,(grouped.get(id)||0)+item.quantity);
 }
 assert([...grouped.values()].every(q=>q<=1000),400,'INVALID_CART_ITEM','Quantité trop importante.');
 return [...grouped.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([product_id,quantity])=>({product_id,quantity}));
}
export function validateShipping(input){
 assert(input&&typeof input==='object',400,'ADDRESS_REQUIRED','Renseignez votre adresse de livraison.');
 const address={};
 for(const key of ['firstName','lastName','address1','city','zip','country']){
  assert(typeof input[key]==='string'&&input[key].trim().length>0&&input[key].length<=160,400,'INVALID_ADDRESS','Adresse de livraison incomplète.');
  address[key]=input[key].trim();
 }
 assert(/^[A-Z]{2}$/.test(address.country),400,'INVALID_COUNTRY','Pays invalide.');
 address.address2=String(input.address2||'').trim().slice(0,160);
 address.phone=String(input.phone||'').trim().slice(0,40);
 return address;
}
export function createCommerceService(database=db,{getStripe=stripeClient,getAppUrl=applicationUrl,getCommission=commission}={}){
 async function products(client,items,lock=false){
  const {rows}=await client.query('SELECT p.*,a.shop_name,a.status AS seller_status,a.stripe_account_id,a.shipping_countries,a.shipping_fee_cents,a.free_shipping_from_cents,a.shipping_configured FROM public."Produit" p JOIN public.bb_seller_accounts a ON a.user_id=p.seller_user_id WHERE p.id=ANY($1::uuid[]) ORDER BY p.id '+(lock?'FOR UPDATE OF p FOR SHARE OF a':''),[items.map(i=>i.product_id)]);
  return new Map(rows.map(p=>[p.id,p]));
 }
 async function quote(client,items,country,lock=false){
  const found=await products(client,items,lock);const sellers=new Map();
  const lines=items.map(item=>{
   const p=found.get(item.product_id);
   assert(p&&p.status==='actif'&&p.seller_status==='active',409,'PRODUCT_UNAVAILABLE','Un produit du panier n’est plus disponible.');
   assert(item.quantity>=Math.max(1,p.min_qty||1)&&p.stock>=item.quantity,409,'INSUFFICIENT_STOCK','Stock ou quantité minimum non respecté pour '+p.name+'.');
   assert(p.shipping_configured&&p.shipping_countries.includes(country),409,'SHIPPING_UNAVAILABLE','La boutique '+p.shop_name+' ne livre pas encore dans ce pays.');
   assert(p.stripe_account_id,409,'SELLER_PAYMENTS_UNAVAILABLE','Les paiements de la boutique '+p.shop_name+' ne sont pas encore activés.');
   const unit=cents(p.price);assert(Number.isSafeInteger(unit)&&unit>0,409,'INVALID_PRICE','Le prix d’un produit doit être corrigé.');
   const seller=sellers.get(p.seller_user_id)||{seller_id:p.seller_user_id,shop_name:p.shop_name,stripe_account_id:p.stripe_account_id,subtotal_cents:0,shipping_fee_cents:p.shipping_fee_cents,free_shipping_from_cents:p.free_shipping_from_cents};
   seller.subtotal_cents+=unit*item.quantity;sellers.set(seller.seller_id,seller);
   return {...item,produit_id:item.product_id,name:p.name,price:unit/100,unit_price:unit/100,seller_id:p.seller_user_id,shop_name:p.shop_name,image_url:p.images?.[0]||p.image_url||null};
  });
  const shipments=[...sellers.values()].map(s=>({...s,shipping_cents:s.free_shipping_from_cents!==null&&s.subtotal_cents>=s.free_shipping_from_cents?0:s.shipping_fee_cents}));
  const subtotal=shipments.reduce((n,s)=>n+s.subtotal_cents,0),shipping=shipments.reduce((n,s)=>n+s.shipping_cents,0);
  assert(Number.isSafeInteger(subtotal+shipping)&&subtotal+shipping>=50&&subtotal+shipping<=99999999,400,'INVALID_ORDER_TOTAL','Le montant du panier doit être compris entre 0,50 € et 999 999,99 €.');
  return {items:lines,shipments,subtotal_cents:subtotal,shipping_cents:shipping,total_cents:subtotal+shipping,currency:'eur'};
 }
 async function cart(user,payload){
  return database.transaction(async client=>{
   await client.query('INSERT INTO public.bb_carts(user_id) VALUES($1) ON CONFLICT DO NOTHING',[user.id]);
   const {rows:[record]}=await client.query('SELECT items FROM public.bb_carts WHERE user_id=$1 FOR UPDATE',[user.id]);
   let items=record.items;
   if(payload){
    const {action,item={}}=payload;const id=item.product_id||item.produit_id;
    assert(['add','merge','remove','increment','decrement','clear'].includes(action),400,'INVALID_CART_ACTION','Action de panier invalide.');
    if(action==='clear')items=[];
    else{
     assert(uuid.test(id||''),400,'INVALID_PRODUCT','Produit invalide.');
     const old=items.find(i=>i.product_id===id);
     if(action==='remove')items=items.filter(i=>i.product_id!==id);
     else{
      const n=action==='merge'?Math.max(old?.quantity||0,item.quantity||1):action==='add'?(old?.quantity||0)+(item.quantity||1):action==='increment'?(old?.quantity||0)+1:Math.max(1,(old?.quantity||1)-1);
      items=normalizeItems([...items.filter(i=>i.product_id!==id),{product_id:id,quantity:n}]);
      const found=await products(client,items);const p=found.get(id);
      assert(p&&p.status==='actif'&&p.seller_status==='active'&&p.stock>=n,409,'PRODUCT_UNAVAILABLE','Produit indisponible ou stock insuffisant.');
     }
    }
    await client.query('UPDATE public.bb_carts SET items=$1::jsonb,updated_at=now() WHERE user_id=$2',[JSON.stringify(items),user.id]);
   }
   const found=items.length?await products(client,items):new Map();
   return {panier:{items:items.map(i=>{const p=found.get(i.product_id);return {...i,produit_id:i.product_id,name:p?.name||'Produit indisponible',price:p?Number(p.price):null,image_url:p?.images?.[0]||p?.image_url,brand:p?.brand,available:!!p&&p.status==='actif'&&p.seller_status==='active'&&p.stock>=i.quantity};})}};
  });
 }
 async function getQuote(input){
  const q=await quote(database,normalizeItems(input.items),input.country||'FR');
  return {...q,shipments:q.shipments.map(({stripe_account_id,...s})=>s)};
 }
 async function checkout(user,input,key){
  assert(typeof key==='string'&&/^[A-Za-z0-9_-]{16,100}$/.test(key),400,'IDEMPOTENCY_REQUIRED','Identifiant de paiement manquant.');
  const stripe=getStripe(),app=getAppUrl(),feeBps=getCommission();
  const items=normalizeItems(input.items),address=validateShipping(input.shipping_address);
  const hash=createHash('sha256').update(JSON.stringify({items,address})).digest('hex');
  const order=await database.transaction(async client=>{
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['checkout:'+user.id+':'+key]);
   const {rows:[existing]}=await client.query('SELECT * FROM public.bb_order_payments WHERE user_id=$1 AND request_key=$2',[user.id,key]);
   if(existing){assert(existing.request_hash===hash,409,'IDEMPOTENCY_CONFLICT','Ce paiement correspond à un autre panier.');return existing;}
   const q=await quote(client,items,address.country,true);
   assert(input.expected_total_cents===q.total_cents,409,'PRICE_CHANGED','Le total a changé. Actualisez le récapitulatif avant de payer.');
   for(const seller of q.shipments){
    const account=await stripe.accounts.retrieve(seller.stripe_account_id);
    assert(account.capabilities?.transfers==='active'&&account.payouts_enabled,409,'SELLER_PAYMENTS_UNAVAILABLE','La boutique '+seller.shop_name+' doit terminer sa configuration de paiement.');
   }
   const id=randomUUID();
   await client.query(`INSERT INTO public."Commande"(id,client_email,client_name,items,total_price,total,subtotal,shipping,status,payment_status,payment_method,shipping_address,shipping_details,created_by_id) VALUES($1,$2,$3,$4::jsonb,$5,$5,$6,$7,'en_attente','non_paye','carte',$8::jsonb,$8::jsonb,$9)`,[id,user.email,address.firstName+' '+address.lastName,JSON.stringify(q.items),q.total_cents/100,q.subtotal_cents/100,q.shipping_cents/100,JSON.stringify(address),user.id]);
   for(const line of q.items){
    const {rows:[stock]}=await client.query('UPDATE public."Produit" SET stock=stock-$1,updated_at=now() WHERE id=$2 AND stock>=$1 RETURNING stock',[line.quantity,line.product_id]);
    assert(stock,409,'INSUFFICIENT_STOCK','Le stock vient de changer.');
    await client.query('INSERT INTO public.bb_inventory_movements(product_id,seller_id,quantity,reason,stock_after,request_key) VALUES($1,$2,$3,$4,$5,$6)',[line.product_id,line.seller_id,-line.quantity,'Réservation commande '+id,stock.stock,'order:'+id+':'+line.product_id]);
    await client.query('INSERT INTO public.bb_order_lines(order_id,seller_id,product_id,product_name,quantity,unit_price) VALUES($1,$2,$3,$4,$5,$6)',[id,line.seller_id,line.product_id,line.name,line.quantity,line.unit_price]);
   }
   for(const s of q.shipments){
    const fee=Math.round(s.subtotal_cents*feeBps/10000);
    await client.query('INSERT INTO public.bb_seller_transfers(order_id,seller_id,stripe_account_id,amount_cents,fee_cents) VALUES($1,$2,$3,$4,$5)',[id,s.seller_id,s.stripe_account_id,s.subtotal_cents+s.shipping_cents-fee,fee]);
   }
   const {rows:[payment]}=await client.query("INSERT INTO public.bb_order_payments(order_id,user_id,request_key,request_hash,amount_cents,expires_at) VALUES($1,$2,$3,$4,$5,date_trunc('second',now())+interval '35 minutes') RETURNING *",[id,user.id,key,hash,q.total_cents]);
   return payment;
  });
  return openCheckout(order,stripe,app,user.email);
 }
 async function openCheckout(order,stripe,app,email){
  assert(['creating','open'].includes(order.status),409,'CHECKOUT_CLOSED','Ce paiement est terminé. Consultez vos commandes.');
  if(order.checkout_url&&new Date(order.expires_at)>new Date())return {checkoutUrl:order.checkout_url,order_id:order.order_id};
  assert(new Date(order.expires_at)>new Date(),409,'CHECKOUT_EXPIRED','Cette tentative a expiré. Le serveur rétablit le stock après vérification du paiement.');
  const session=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card','link'],customer_email:email,client_reference_id:order.user_id,
   metadata:{order_id:order.order_id},payment_intent_data:{transfer_group:'order_'+order.order_id,metadata:{order_id:order.order_id}},
   line_items:[{price_data:{currency:'eur',unit_amount:Number(order.amount_cents),product_data:{name:'Commande BeautyBook '+order.order_id.slice(0,8)}},quantity:1}],
   expires_at:Math.floor(new Date(order.expires_at).getTime()/1000),success_url:app+'/mes-commandes?payment=verification',cancel_url:app+'/panier?payment=cancelled',
  },{idempotencyKey:'commerce-'+order.order_id});
  assert(session.id&&session.url,502,'CHECKOUT_FAILED','La page de paiement n’a pas pu être créée.');
  await database.query("UPDATE public.bb_order_payments SET stripe_session_id=$1,checkout_url=$2,status=CASE WHEN status='creating' THEN 'open' ELSE status END,updated_at=now() WHERE order_id=$3",[session.id,session.url,order.order_id]);
  return {checkoutUrl:session.url,order_id:order.order_id};
 }
 async function restoreStock(client,orderId){
  const {rows:lines}=await client.query('SELECT * FROM public.bb_order_lines WHERE order_id=$1 ORDER BY product_id FOR UPDATE',[orderId]);
  for(const line of lines){
   if(line.stock_released)continue;
   if(line.product_id){
    const {rows:[p]}=await client.query('UPDATE public."Produit" SET stock=stock+$1,updated_at=now() WHERE id=$2 RETURNING stock',[line.quantity,line.product_id]);
    if(p&&line.seller_id)await client.query('INSERT INTO public.bb_inventory_movements(product_id,seller_id,quantity,reason,stock_after,request_key) VALUES($1,$2,$3,$4,$5,$6)',[line.product_id,line.seller_id,line.quantity,'Annulation commande '+orderId,p.stock,'restore:'+orderId+':'+line.id]);
   }
   await client.query('UPDATE public.bb_order_lines SET stock_released=true WHERE id=$1',[line.id]);
  }
  await client.query("UPDATE public.bb_order_lines SET status='cancelled',updated_at=now() WHERE order_id=$1",[orderId]);
 }
 async function handleEvent(event){
  const session=event.data.object;
  return database.transaction(async client=>{
   const {rows:[p]}=await client.query('SELECT * FROM public.bb_order_payments WHERE order_id::text=$1 FOR UPDATE',[session.metadata?.order_id||'']);
   if(!p)return {received:true};
   assert(!p.stripe_session_id||p.stripe_session_id===session.id,409,'PAYMENT_MISMATCH','Session de paiement incorrecte.');
   const {rows:events}=await client.query('INSERT INTO public.bb_webhook_events(provider,event_id,event_type) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id',['stripe',event.id,event.type]);
   if(!events.length)return {received:true,duplicate:true};
   if(event.type==='checkout.session.expired'){
    if(['creating','open'].includes(p.status)){
     await restoreStock(client,p.order_id);
     await client.query("UPDATE public.bb_order_payments SET status='expired',updated_at=now() WHERE order_id=$1",[p.order_id]);
     await client.query('UPDATE public."Commande" SET status=$1,updated_at=now() WHERE id=$2',['annule',p.order_id]);
     await client.query("UPDATE public.bb_seller_transfers SET status='cancelled' WHERE order_id=$1",[p.order_id]);
    }
    return {received:true};
   }
   if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)||session.payment_status!=='paid')return {received:true};
   assert(session.currency===p.currency&&session.amount_total===Number(p.amount_cents)&&session.client_reference_id===p.user_id&&typeof session.payment_intent==='string',409,'PAYMENT_MISMATCH','Le paiement ne correspond pas à la commande.');
   if(['paid','refund_required','refunded'].includes(p.status))return {received:true,duplicate:true};
   const late=p.status==='expired';
   await client.query('UPDATE public.bb_order_payments SET status=$1,payment_intent_id=$2,stripe_session_id=$3,updated_at=now() WHERE order_id=$4',[late?'refund_required':'paid',session.payment_intent,session.id,p.order_id]);
   if(!late){
    await client.query('UPDATE public."Commande" SET status=$1,payment_status=$2,payment_intent_id=$3,updated_at=now() WHERE id=$4',['confirme','paye',session.payment_intent,p.order_id]);
    await client.query("UPDATE public.bb_order_lines SET status='paid',updated_at=now() WHERE order_id=$1",[p.order_id]);
    const {rows:[cart]}=await client.query('SELECT items FROM public.bb_carts WHERE user_id=$1 FOR UPDATE',[p.user_id]);
    if(cart){
     const {rows:lines}=await client.query('SELECT product_id,quantity FROM public.bb_order_lines WHERE order_id=$1',[p.order_id]);
     const purchased=new Map(lines.map(l=>[l.product_id,l.quantity]));
     const remaining=cart.items.map(i=>({...i,quantity:Math.max(0,i.quantity-(purchased.get(i.product_id)||0))})).filter(i=>i.quantity>0);
     await client.query('UPDATE public.bb_carts SET items=$1::jsonb,updated_at=now() WHERE user_id=$2',[JSON.stringify(remaining),p.user_id]);
    }
   }
   await client.query('INSERT INTO public.bb_outbox(topic,aggregate_id,payload) VALUES($1,$2,$3::jsonb)',[late?'commerce.refund':'commerce.paid',p.order_id,JSON.stringify({order_id:p.order_id})]);
   return {received:true};
  });
 }
 async function orderDetail(user,id){
  const {rows:[order]}=await database.query('SELECT *,coalesce(shipping_details,to_jsonb(shipping_address)) AS shipping_address FROM public."Commande" WHERE id::text=$1 AND created_by_id=$2',[id,user.id]);
  assert(order,404,'ORDER_NOT_FOUND','Commande introuvable.');
  const {rows:lines}=await database.query('SELECT id,product_name,quantity,unit_price,status,tracking_number,carrier FROM public.bb_order_lines WHERE order_id=$1 ORDER BY created_at',[order.id]);
  const {rows:[payment]}=await database.query('SELECT status FROM public.bb_order_payments WHERE order_id=$1',[order.id]);
  return {order,lines,payment_status:payment?.status};
 }
 async function deliverEvent(client,event){
  const stripe=getStripe();
  const {rows:[p]}=await client.query('SELECT * FROM public.bb_order_payments WHERE order_id=$1 FOR UPDATE',[event.aggregate_id]);
  if(!p)return {notify:false};
  if(event.topic==='commerce.paid'){
   if(p.status!=='paid')return {notify:false};
   const intent=await stripe.paymentIntents.retrieve(p.payment_intent_id);
   assert(typeof intent.latest_charge==='string',502,'CHARGE_PENDING','La transaction attend sa confirmation.');
   const {rows:transfers}=await client.query('SELECT * FROM public.bb_seller_transfers WHERE order_id=$1 ORDER BY seller_id FOR UPDATE',[p.order_id]);
   for(const t of transfers){
    if(t.status!=='pending')continue;
    if(Number(t.amount_cents)>0){
     const result=await stripe.transfers.create({amount:Number(t.amount_cents),currency:p.currency,destination:t.stripe_account_id,source_transaction:intent.latest_charge,transfer_group:'order_'+p.order_id},{idempotencyKey:'seller-transfer-'+t.id});
     assert(result.id,502,'TRANSFER_FAILED','Le transfert n’a pas été confirmé.');
     await client.query("UPDATE public.bb_seller_transfers SET stripe_transfer_id=$1,status='transferred' WHERE id=$2",[result.id,t.id]);
    }else await client.query("UPDATE public.bb_seller_transfers SET status='transferred' WHERE id=$1",[t.id]);
   }
  }else if(event.topic==='commerce.refund'){
   if(p.status==='refunded')return {notify:true};
   assert(p.status==='refund_required',409,'REFUND_NOT_READY','Remboursement non demandé.');
   const {rows:transfers}=await client.query('SELECT * FROM public.bb_seller_transfers WHERE order_id=$1 ORDER BY seller_id FOR UPDATE',[p.order_id]);
   for(const t of transfers){
    if(t.status==='transferred'&&t.stripe_transfer_id)await stripe.transfers.createReversal(t.stripe_transfer_id,{}, {idempotencyKey:'seller-reversal-'+t.id});
    await client.query("UPDATE public.bb_seller_transfers SET status=CASE WHEN status='transferred' THEN 'reversed' ELSE 'cancelled' END WHERE id=$1 AND status NOT IN ('reversed','cancelled')",[t.id]);
   }
   const refund=await stripe.refunds.create({payment_intent:p.payment_intent_id},{idempotencyKey:'order-refund-'+p.order_id});
   const confirmed=refund.status==='succeeded'?refund:await stripe.refunds.retrieve(refund.id);
   assert(confirmed.status==='succeeded',502,'REFUND_PENDING','Le remboursement attend sa confirmation.');
   await restoreStock(client,p.order_id);
   await client.query("UPDATE public.bb_order_payments SET status='refunded',updated_at=now() WHERE order_id=$1",[p.order_id]);
   await client.query('UPDATE public."Commande" SET status=$1,payment_status=$1,updated_at=now() WHERE id=$2',['rembourse',p.order_id]);
   await client.query("UPDATE public.bb_order_lines SET status='refunded',updated_at=now() WHERE order_id=$1",[p.order_id]);
  }
  return {notify:true};
 }
 async function requestRefund(user,id,{admin=false,requestId}={}){
  return database.transaction(async client=>{
   const {rows:[p]}=await client.query('SELECT * FROM public.bb_order_payments WHERE order_id::text=$1 FOR UPDATE',[id]);
   assert(p&&(admin||p.user_id===user.id),404,'ORDER_NOT_FOUND','Commande introuvable.');
   if(['refund_required','refunded'].includes(p.status))return {status:p.status};
   assert(p.status==='paid',409,'ORDER_NOT_PAID','Cette commande n’est pas payée.');
   const {rows:lines}=await client.query('SELECT status FROM public.bb_order_lines WHERE order_id=$1 FOR UPDATE',[p.order_id]);
   assert(lines.every(l=>['paid','preparing'].includes(l.status)),409,'ORDER_ALREADY_SHIPPED','Une expédition a commencé. Contactez le support pour organiser le retour.');
   await client.query("UPDATE public.bb_order_payments SET status='refund_required',updated_at=now() WHERE order_id=$1",[p.order_id]);
   await client.query("UPDATE public.bb_order_lines SET status='cancelled',updated_at=now() WHERE order_id=$1",[p.order_id]);
   await client.query('UPDATE public."Commande" SET status=$1,updated_at=now() WHERE id=$2',['annule',p.order_id]);
   await client.query('INSERT INTO public.bb_outbox(topic,aggregate_id,payload) VALUES($1,$2,$3::jsonb)',['commerce.refund',p.order_id,JSON.stringify({order_id:p.order_id})]);
   if(admin)await client.query('INSERT INTO public.bb_audit_log(actor_id,action,resource,resource_id,request_id) VALUES($1,$2,$3,$4,$5)',[user.id,'refund.request','Commande',id,requestId]);
   return {status:'refund_required'};
  });
 }
 async function reconcileOne(){
  const {rows:[p]}=await database.query("UPDATE public.bb_order_payments SET reconcile_after=now()+interval '5 minutes' WHERE order_id=(SELECT order_id FROM public.bb_order_payments WHERE status IN ('creating','open') AND expires_at<now() AND reconcile_after<=now() ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *");
  if(!p)return false;
  const stripe=getStripe();let session;
  if(p.stripe_session_id)session=await stripe.checkout.sessions.retrieve(p.stripe_session_id);
  else{
   // A timeout may have occurred between Stripe creation and saving its ID.
   // Only release inventory after checking the provider, never based on a browser redirect.
   let after;
   for(let page=0;page<100;page++){
    const result=await stripe.checkout.sessions.list({created:{gte:Math.floor(new Date(p.created_at).getTime()/1000)-60,lte:Math.ceil(new Date(p.expires_at).getTime()/1000)+60},limit:100,...(after?{starting_after:after}:{})});
    session=result.data.find(s=>s.metadata?.order_id===p.order_id);
    if(session||!result.has_more)break;
    assert(page<99,503,'RECONCILIATION_LIMIT','La vérification du paiement nécessite une intervention.');
    after=result.data.at(-1)?.id;
   }
  }
  if(session?.status==='open')session=await stripe.checkout.sessions.expire(session.id);
  if(session){
   assert(session.status==='expired'||session.payment_status==='paid',503,'PAYMENT_UNRESOLVED','Le paiement attend une vérification.');
   await handleEvent({id:'reconcile_'+session.id+'_'+session.status,type:session.payment_status==='paid'?'checkout.session.completed':'checkout.session.expired',data:{object:session}});
  }else await database.transaction(async client=>{
   const {rows:[current]}=await client.query('SELECT * FROM public.bb_order_payments WHERE order_id=$1 FOR UPDATE',[p.order_id]);
   if(current.status!=='creating'||current.stripe_session_id)return;
   await restoreStock(client,p.order_id);
   await client.query("UPDATE public.bb_order_payments SET status='expired',updated_at=now() WHERE order_id=$1",[p.order_id]);
   await client.query('UPDATE public."Commande" SET status=$1,updated_at=now() WHERE id=$2',['annule',p.order_id]);
   await client.query("UPDATE public.bb_seller_transfers SET status='cancelled' WHERE order_id=$1",[p.order_id]);
  });
  return true;
 }
 return {cart,getQuote,checkout,handleEvent,orderDetail,deliverEvent,requestRefund,reconcileOne};
}
export const commerce=createCommerceService();
