import db from '../config/pg.js';
import {assert} from '../lib/errors.js';

export function createAdminOperations(database=db){
 const audit=(client,user,action,resource,id,changes,requestId)=>client.query('INSERT INTO public.bb_audit_log(actor_id,action,resource,resource_id,changes,request_id) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[user.id,action,resource,String(id),JSON.stringify(changes),requestId]);
 async function approveProfessional(user,id,input,requestId){
  assert(['approuvee','refusee'].includes(input.status),400,'INVALID_STATUS','Décision invalide.');
  return database.transaction(async client=>{
   const {rows:[application]}=await client.query('SELECT * FROM public."DemandeProV2" WHERE id::text=$1 FOR UPDATE',[id]);
   assert(application,404,'APPLICATION_NOT_FOUND','Demande introuvable.');
   assert(!['approuvee','refusee'].includes(application.statut||application.status),409,'APPLICATION_PROCESSED','Cette demande a déjà été traitée.');
   const {rows:[account]}=await client.query('SELECT id,email FROM auth.users WHERE lower(email)=lower($1)',[application.user_email]);
   assert(account,409,'ACCOUNT_NOT_FOUND','Le compte lié à cette demande n’existe plus.');
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['professional:'+account.id]);
   if(input.status==='approuvee'){
    const {rows:[existing]}=await client.query('SELECT id FROM public."ProfilPro" WHERE owner_id=$1 OR user_email=$2 ORDER BY created_at LIMIT 1',[account.id,account.email]);
    const data={user_email:account.email,owner_id:account.id,created_by_id:account.id,salon_name:application.salon_name||[application.prenom,application.nom].filter(Boolean).join(' '),bio:application.bio||application.description||'',address:application.address||'',city:application.city||'',phone:application.phone||'',specialites:application.specialites||application.categories||[],categorie:application.categorie||'',avatar_url:application.avatar_url||application.salon_photo||'',cover_url:application.cover_url||'',status:'actif'};
    assert(data.salon_name,409,'INCOMPLETE_APPLICATION','Le nom du professionnel doit être renseigné.');
    const keys=Object.keys(data).map(k=>'"'+k+'"').join(',');
    if(existing)await client.query(`UPDATE public."ProfilPro" SET (${keys})=(SELECT ${keys} FROM jsonb_populate_record(NULL::public."ProfilPro",$1::jsonb)),updated_at=now() WHERE id=$2`,[JSON.stringify(data),existing.id]);
    else await client.query(`INSERT INTO public."ProfilPro" (${keys}) SELECT ${keys} FROM jsonb_populate_record(NULL::public."ProfilPro",$1::jsonb)`,[JSON.stringify(data)]);
    await client.query("UPDATE public.profiles SET role='vendeur',updated_at=now() WHERE id=$1",[account.id]);
   }
   const {rows:[result]}=await client.query('UPDATE public."DemandeProV2" SET statut=$1,status=$1,admin_notes=$2,updated_at=now() WHERE id=$3 RETURNING *',[input.status,String(input.note||'').slice(0,2000),application.id]);
   await audit(client,user,'professional.review','DemandeProV2',id,{status:input.status},requestId);
   await client.query('INSERT INTO public.bb_outbox(topic,aggregate_id,payload) VALUES($1,$2,$3::jsonb)',['professional.reviewed',application.id,JSON.stringify({user_id:account.id,status:input.status})]);
   return result;
  });
 }
 async function updateMembership(user,id,input,requestId){
  assert(id!==user.id,409,'SELF_ACCESS_CHANGE','Un autre responsable doit modifier votre propre accès.');
  const roles={support:['users:read','professionals:read','bookings:read','bookings:write','orders:read','support:read','support:write','operations:read'],moderator:['content:read','content:write','reports:read','reports:write','categories:read','categories:write'],administrator:['users:read','professionals:read','professionals:write','sellers:read','sellers:write','products:read','products:write','services:read','services:write','bookings:read','bookings:write','orders:read','configuration:read','configuration:write','operations:read','audit:read','notifications:read','notifications:write'],owner:['*']};
  assert(roles[input.role] && typeof input.active==='boolean',400,'INVALID_MEMBERSHIP','Habilitation invalide.');
  return database.transaction(async client=>{
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended('admin-memberships',0))");
   const {rows:[account]}=await client.query('SELECT id FROM auth.users WHERE id::text=$1',[id]);
   assert(account,404,'USER_NOT_FOUND','Compte introuvable.');
   const {rows:[current]}=await client.query('SELECT role,active FROM public.bb_admin_memberships WHERE user_id=$1',[id]);
   if(current?.active && current.role==='owner' && (!input.active||input.role!=='owner')){
    const {rows:[owners]}=await client.query("SELECT count(*)::int AS n FROM public.bb_admin_memberships WHERE active AND role='owner'");
    assert(owners.n>1,409,'LAST_OWNER','Le dernier responsable ne peut pas être désactivé.');
   }
   const {rows:[result]}=await client.query(`INSERT INTO public.bb_admin_memberships(user_id,role,permissions,active) VALUES($1,$2,$3,$4)
     ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role,permissions=EXCLUDED.permissions,active=EXCLUDED.active RETURNING user_id,role,permissions,active`,[id,input.role,roles[input.role],input.active]);
   await audit(client,user,'admin.membership','bb_admin_memberships',id,{role:input.role,active:input.active},requestId);
   return result;
  });
 }
 async function stats(){
  const {rows:[result]}=await database.query(`SELECT
   (SELECT count(*)::int FROM public.profiles) AS users,
   (SELECT count(*)::int FROM public."Service") AS services,
   (SELECT count(*)::int FROM public."Produit") AS products,
   (SELECT count(*)::int FROM public."Reel") AS reels,
   (SELECT count(*)::int FROM public."Style") AS styles,
   (SELECT count(*)::int FROM public."ProfilPro" WHERE status='actif') AS professionals,
   (SELECT count(*)::int FROM public.bb_seller_accounts WHERE status='pending') AS pending_sellers,
   (SELECT count(*)::int FROM public."Reservation") AS reservations,
   (SELECT count(*)::int FROM public."Reservation" WHERE status='en_attente') AS reservations_pending,
   (SELECT count(*)::int FROM public."Commande") AS commandes,
   (SELECT coalesce(sum(amount_cents),0)::bigint FROM public.bb_payment_sessions WHERE status='paid') AS paid_cents`);
  return result;
 }
 return {approveProfessional,updateMembership,stats};
}
export const {approveProfessional,updateMembership,stats:adminStats}=createAdminOperations();
