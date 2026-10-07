import {useState,useEffect,useCallback} from 'react';
import {Store,Users,CalendarDays,Package,RefreshCw,ShieldCheck,FileText,Activity,Search,ArrowUpRight} from 'lucide-react';
import api from '@/lib/apiClient';

const input='w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm';
const button='min-h-12 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50';
const primary=button+' bg-gray-900 text-white';
const money=value=>Number(value||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
function ErrorBox({error,retry}){return error?<div role="alert" className="my-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-4 underline" onClick={retry}>Réessayer</button></div>:null;}
function useRecords(table){
 const [rows,setRows]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const load=useCallback(async()=>{setLoading(true);setError('');try{setRows((await api.post('/admin/entities',{table,operation:'list',limit:500})).result);}catch(e){setError(e.message);}finally{setLoading(false);}},[table]);
 useEffect(()=>{load();},[load]);return {rows,error,loading,load,setError};
}
function Heading({title,children,loading,load}){return <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-gray-900">{title}</h2><p className="mt-2 text-sm text-gray-600">{children}</p></div><button className={button} onClick={load} disabled={loading}><RefreshCw size={17} className={'mr-2 inline '+(loading?'animate-spin':'')}/>Actualiser</button></div>;}

export function SellerManagement(){
 const state=useRecords('bb_seller_accounts'),[search,setSearch]=useState(''),[busy,setBusy]=useState('');
 async function status(row,value){setBusy(row.user_id);try{await api.post('/admin/entities',{table:'bb_seller_accounts',operation:'update',id:row.user_id,data:{status:value}});await state.load();}catch(e){state.setError(e.message);}finally{setBusy('');}}
 return <section><Heading title="Les boutiques partenaires" {...state}>Validez les demandes d’accès et gérez les boutiques de l’application vendeur.</Heading><ErrorBox error={state.error} retry={state.load}/><label className="mb-5 block text-sm">Rechercher une boutique<input className={input+' mt-2'} value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="grid gap-4 xl:grid-cols-2">{state.rows?.filter(r=>r.shop_name.toLowerCase().includes(search.toLowerCase())).map(row=><article className="rounded-2xl border border-gray-200 bg-white p-6" key={row.user_id}><Store className="mb-4 text-primary"/><h3 className="text-lg font-bold">{row.shop_name}</h3><p className="mt-2 text-sm text-gray-600">{({pending:'En attente de validation',active:'Boutique active',suspended:'Boutique suspendue'})[row.status]}</p><p className="mt-2 break-all text-xs text-gray-500">Compte : {row.user_id}</p><div className="mt-5 flex flex-wrap gap-3">{row.status!=='active'&&<button className={primary} disabled={busy===row.user_id} onClick={()=>status(row,'active')}>{row.status==='pending'?'Valider la boutique':'Réactiver'}</button>}{row.status==='active'&&<button className={button} disabled={busy===row.user_id} onClick={()=>status(row,'suspended')}>Suspendre la boutique</button>}</div></article>)}</div>{state.rows?.length===0&&!state.error&&<p className="rounded-xl bg-white p-8 text-gray-600">Aucune demande de boutique enregistrée.</p>}</section>;
}

export function ProfessionalManagement(){
 const state=useRecords('DemandeProV2'),[busy,setBusy]=useState(''),[note,setNote]=useState({}),[documentUrl,setDocumentUrl]=useState(null);
 async function review(row,status){setBusy(row.id);try{await api.post('/admin/professionals/'+row.id+'/review',{status,note:note[row.id]||''});await state.load();}catch(e){state.setError(e.message);}finally{setBusy('');}}
 async function document(path){try{setDocumentUrl(null);const result=await api.post('/admin/private-document',{path});setDocumentUrl(result.url);}catch(e){state.setError(e.message);}}
 return <section><Heading title="Demandes professionnelles" {...state}>L’approbation active le profil et ses droits dans une transaction unique.</Heading><ErrorBox error={state.error} retry={state.load}/>{documentUrl&&<p className="mb-5 rounded-xl bg-green-50 p-4"><a className="font-semibold underline" href={documentUrl} target="_blank" rel="noopener noreferrer">Ouvrir le document sécurisé (lien valable une minute)</a></p>}<div className="space-y-4">{state.rows?.map(row=>{const status=row.statut||row.status;const pending=!['approuvee','refusee'].includes(status);return <article className="rounded-2xl border border-gray-200 bg-white p-6" key={row.id}><div className="flex flex-wrap justify-between gap-4"><div><h3 className="text-lg font-bold">{row.salon_name||[row.prenom,row.nom].filter(Boolean).join(' ')}</h3><p className="mt-1 text-sm text-gray-600">{row.user_email} · {row.city}</p></div><span className="text-sm font-semibold">{({approuvee:'Approuvée',refusee:'Refusée',en_attente:'En attente',pending:'En attente'})[status]||status}</span></div><p className="my-4 text-sm leading-relaxed text-gray-600">{row.bio||row.description}</p><div className="mb-5 flex flex-wrap gap-3">{[['doc_identite_recto','Identité recto'],['doc_identite_verso','Identité verso'],['doc_siret','SIRET'],['doc_assurance','Assurance']].filter(([field])=>row[field]).map(([field,label])=><button key={field} className={button} onClick={()=>document(row[field])}><FileText size={16} className="mr-2 inline"/>{label}</button>)}</div>{pending&&<><label className="block text-sm">Note de traitement<textarea className={input+' my-2'} maxLength={2000} value={note[row.id]||''} onChange={e=>setNote({...note,[row.id]:e.target.value})}/></label><div className="mt-3 flex gap-3"><button className={primary} disabled={busy===row.id} onClick={()=>review(row,'approuvee')}>Approuver</button><button className={button} disabled={busy===row.id} onClick={()=>review(row,'refusee')}>Refuser</button></div></>}</article>;})}</div>{state.rows?.length===0&&!state.error&&<p>Aucune demande enregistrée.</p>}</section>;
}

export function UserManagement(){
 const state=useRecords('profiles'),[search,setSearch]=useState(''),[memberships,setMemberships]=useState(null),[selection,setSelection]=useState(null),[role,setRole]=useState('support'),[busy,setBusy]=useState(false);
 async function access(){try{setMemberships((await api.get('/admin/memberships')).memberships);}catch(e){state.setError(e.message);}}
 async function save(active){setBusy(true);try{await api.put('/admin/memberships/'+selection.id,{role,active});await access();setSelection(null);}catch(e){state.setError(e.message);}finally{setBusy(false);}}
 return <section><Heading title="Comptes et habilitations" {...state}>Les droits d’administration sont séparés des profils clients et professionnels.</Heading><ErrorBox error={state.error} retry={state.load}/><div className="mb-5 flex flex-wrap gap-3"><label className="min-w-60 flex-1 text-sm">Rechercher un compte<input className={input+' mt-2'} value={search} onChange={e=>setSearch(e.target.value)}/></label><button className={button+' self-end'} onClick={access}><ShieldCheck size={17} className="mr-2 inline"/>Charger les habilitations</button></div>{selection&&<form className="mb-5 rounded-2xl border bg-white p-5" onSubmit={e=>{e.preventDefault();save(true);}}><h3 className="mb-3 font-bold">Accès de {selection.email}</h3><label>Rôle<select className={input+' my-3'} value={role} onChange={e=>setRole(e.target.value)}><option value="support">Support</option><option value="moderator">Modération</option><option value="administrator">Administration métier</option><option value="owner">Responsable des accès</option></select></label><div className="flex flex-wrap gap-3"><button className={primary} disabled={busy}>Enregistrer l’habilitation</button><button type="button" className={button} disabled={busy} onClick={()=>save(false)}>Révoquer l’accès</button><button type="button" className={button} onClick={()=>setSelection(null)}>Annuler</button></div></form>}<div className="space-y-3">{state.rows?.filter(row=>[row.email,row.full_name].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase()))).map(row=>{const membership=memberships?.find(m=>m.user_id===row.id&&m.active);return <article key={row.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-5"><div><strong>{row.full_name||'Compte sans nom'}</strong><p className="mt-1 text-sm text-gray-600">{row.email}</p><p className="mt-1 text-xs text-gray-500">Profil : {row.role}{membership?' · Admin : '+membership.role:''}</p></div>{memberships&&<button className={button} onClick={()=>{setSelection(row);setRole(membership?.role||'support');}}>Gérer l’accès</button>}</article>;})}</div></section>;
}

import { adminApi } from '@/lib/adminApiClient';

export function Overview(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const load=useCallback(async()=>{
   setLoading(true);
   try{
     const stats = await adminApi.getStats();
     setData({
       users: stats.users,
       professionals: stats.styles,
       pending_sellers: 0,
       products: stats.services,
       reservations: stats.reservations,
       reservations_pending: stats.reservations_pending,
       commandes: stats.commandes,
       paid_cents: 0,
       reels: stats.reels,
       lives: stats.lives_actifs
     });
     setError('');
   }catch(e){
     setError(e.message);
   }finally{
     setLoading(false);
   }
 },[]);
 useEffect(()=>{
   load();
   const refresh=()=>{if(document.visibilityState==='visible')load();};
   window.addEventListener('focus',refresh);
   const timer=setInterval(refresh,15000);
   return()=>{window.removeEventListener('focus',refresh);clearInterval(timer);};
 },[load]);
 const metrics=[['Comptes utilisateurs',data?.users,Users],['Styles & Prestations',data?.professionals,ShieldCheck],['Services actifs',data?.products,Package],['Réservations totales',data?.reservations,CalendarDays],['Rendez-vous en attente',data?.reservations_pending,CalendarDays],['Commandes',data?.commandes,Package],['Réels publiés',data?.reels,Activity],['Lives actifs',data?.lives,ArrowUpRight]];
 return <section><Heading title="L’activité de BeautyBook" load={load} loading={loading}>Les indicateurs sont calculés directement à partir de la base de données Supabase.</Heading><ErrorBox error={error} retry={load}/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label,value,Icon])=><article className="rounded-2xl border border-gray-200 bg-white p-6" key={label}><Icon className="mb-5 text-primary" size={24}/><p className="text-sm text-gray-600">{label}</p><p className="mt-3 text-3xl font-bold">{value??'—'}</p></article>)}</div></section>;
}

export function Operations(){
 const state=useRecords('bb_outbox'),[health,setHealth]=useState(null);
 useEffect(()=>{api.get('/admin/health').then(setHealth).catch(e=>state.setError(e.message));},[]);
 return <section><Heading title="État des traitements" {...state}>Notifications, paiements et événements métier enregistrés par le serveur.</Heading><ErrorBox error={state.error} retry={state.load}/>{health&&<p className="mb-5 rounded-xl border bg-white p-5">Base de données : {health.database.ok?'connectée':'indisponible'} · {health.database.latency_ms} ms</p>}<div className="space-y-3">{state.rows?.map(row=><article key={row.id} className="flex flex-wrap justify-between gap-4 rounded-xl border bg-white p-4"><div><strong>{row.topic}</strong><p className="mt-1 text-xs text-gray-500">{new Date(row.created_at).toLocaleString('fr-FR')}</p></div><div><p>{row.status} · {row.attempts} tentative(s)</p>{row.last_error_code&&<p className="text-red-700">{row.last_error_code}</p>}</div></article>)}</div>{state.rows?.length===0&&<p>Aucun traitement enregistré.</p>}</section>;
}
