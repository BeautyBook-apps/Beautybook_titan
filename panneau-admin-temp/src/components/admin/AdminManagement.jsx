import {useState,useEffect,useCallback} from 'react';
import {Store,Users,CalendarDays,Package,RefreshCw,ShieldCheck,FileText,Activity,ArrowUpRight,Building2,Home,Scissors,BarChart3,Clock3,CheckCircle2,TrendingUp,Layers3,CreditCard} from 'lucide-react';
import {AreaChart,Area,BarChart,Bar,CartesianGrid,XAxis,YAxis,Tooltip,ResponsiveContainer,Legend,PieChart,Pie,Cell} from 'recharts';
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

const CHART_COLORS = ['#ff7a00', '#111827', '#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
const number = value => Number(value || 0).toLocaleString('fr-FR');
const percent = (value, total) => total ? `${Math.round((value / total) * 100)}%` : '0%';
const rowsFrom = result => Array.isArray(result) ? result : result?.data?.results || result?.data || [];
const statusOf = row => String(row?.status || row?.statut || '').toLowerCase();
const dateOf = row => row?.created_at || row?.created_date || row?.updated_at || row?.date_creation;
const PLAN_PRICES = { gratuit: 0, free: 0, basique: 0, beautyplus: 9.99, 'beauty plus': 9.99, premium: 19, gold: 49 };
const planOf = row => String(row?.plan_name || row?.plan_id || row?.abonnement || 'Gratuit').trim() || 'Gratuit';
const planPriceOf = row => Number(row?.plan_price ?? PLAN_PRICES[planOf(row).toLowerCase()] ?? 0) || 0;
const activeSubscription = row => ['active', 'actif', 'trialing', 'en_cours', 'en cours'].includes(statusOf(row));
const paidRecord = row => ['paid', 'paye', 'payé', 'confirme', 'confirmed', 'acompte_paye'].includes(String(row?.payment_status || row?.status || '').toLowerCase());
const amountOf = row => Number(row?.amount ?? row?.total ?? row?.total_price ?? row?.service_price ?? 0) || 0;

function DashboardKpi({label, value, hint, Icon, tone = 'orange', trend}) {
  const tones = {
    orange: 'bg-orange-50 text-orange-500',
    indigo: 'bg-indigo-50 text-indigo-500',
    emerald: 'bg-emerald-50 text-emerald-500',
    slate: 'bg-slate-100 text-slate-600',
    rose: 'bg-rose-50 text-rose-500',
  };
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone] || tones.orange}`}><Icon size={21}/></div>
      {trend && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600"><TrendingUp size={12}/>{trend}</span>}
    </div>
    <p className="mt-5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{value ?? '—'}</p>
    {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
  </article>;
}

function DashboardCard({title, subtitle, children, className = ''}) {
  return <article className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="text-[14px] font-black text-slate-900">{title}</h3>{subtitle && <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p>}</div></div>
    {children}
  </article>;
}

function ChartTooltip({active, payload, label}) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"><p className="mb-1 font-bold text-slate-700">{label}</p>{payload.map(item => <p key={item.dataKey} style={{color: item.color}}>{item.name || item.dataKey}: <strong>{number(item.value)}</strong></p>)}</div>;
}

export function Overview(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const load=useCallback(async()=>{
   setLoading(true);
   const requests = await Promise.allSettled([
     adminApi.getStats(),
     adminApi.listUsers(),
     adminApi.listProfilsPro(),
     adminApi.listAnnonces(),
     adminApi.listReservations(),
     adminApi.listServices(),
     adminApi.listStyles(),
     adminApi.listCommandes(),
     adminApi.listSubscriptions(),
   ]);
   const [statsResult, usersResult, professionalsResult, listingsResult, reservationsResult, servicesResult, stylesResult, ordersResult, subscriptionsResult] = requests;
   const stats = statsResult.status === 'fulfilled' ? statsResult.value || {} : {};
   const users = usersResult.status === 'fulfilled' ? rowsFrom(usersResult.value) : [];
   const professionals = professionalsResult.status === 'fulfilled' ? rowsFrom(professionalsResult.value) : [];
   const listings = listingsResult.status === 'fulfilled' ? rowsFrom(listingsResult.value) : [];
   const reservations = reservationsResult.status === 'fulfilled' ? rowsFrom(reservationsResult.value) : [];
   const services = servicesResult.status === 'fulfilled' ? rowsFrom(servicesResult.value) : [];
   const styles = stylesResult.status === 'fulfilled' ? rowsFrom(stylesResult.value) : [];
   const orders = ordersResult.status === 'fulfilled' ? rowsFrom(ordersResult.value) : [];
   const subscriptions = subscriptionsResult.status === 'fulfilled' ? rowsFrom(subscriptionsResult.value) : [];
   const activeServices = services.filter(row => ['actif', 'active', 'publie', 'published'].includes(statusOf(row)));
   const publishedStyles = styles.filter(row => ['publie', 'published', 'active'].includes(statusOf(row)));
   const activeListings = listings.filter(row => !['archive', 'supprime', 'deleted', 'inactive', 'pause'].includes(statusOf(row)));
   const pendingReservations = reservations.filter(row => ['en_attente', 'pending', 'requested'].includes(statusOf(row)));
   const pendingProfessionals = professionals.filter(row => ['en_attente', 'pending', 'pending_review'].includes(statusOf(row)));
   const professionalCount = professionals.length || Number(stats.professionals || 0);
   const individualCount = Math.max(0, (users.length || Number(stats.users || 0)) - professionalCount);
   const activeSubscriptions = subscriptions.filter(activeSubscription);
   const paidSubscriptions = subscriptions.filter(row => row.payment_status ? paidRecord(row) : planPriceOf(row) > 0 && activeSubscription(row));
   const subscriptionRevenue = paidSubscriptions.reduce((sum, row) => sum + planPriceOf(row), 0);
   const paidOrders = orders.filter(paidRecord);
   const orderRevenue = paidOrders.reduce((sum, row) => sum + amountOf(row), 0);
   const paidReservations = reservations.filter(row => ['paye', 'payé', 'paid', 'acompte_paye'].includes(String(row.payment_status || '').toLowerCase()));
   const reservationRevenue = paidReservations.reduce((sum, row) => sum + amountOf(row), 0);
   const revenue = subscriptionRevenue + orderRevenue + reservationRevenue;
   const currentByUser = new Map();
   [...activeSubscriptions].sort((a, b) => new Date(dateOf(b) || 0) - new Date(dateOf(a) || 0)).forEach(row => {
     const key = String(row.user_email || row.user_id || row.id);
     if (!currentByUser.has(key)) currentByUser.set(key, row);
   });
   const profilePlans = [...professionals, ...users].reduce((acc, row) => {
     const key = planOf(row);
     if (!acc[key]) acc[key] = {name: key, professionnels: 0, utilisateurs: 0, revenus: 0};
     const isProfessional = professionals.includes(row);
     if (isProfessional) acc[key].professionnels += 1;
     else acc[key].utilisateurs += 1;
     return acc;
   }, {});
   currentByUser.forEach(row => {
     const key = planOf(row);
     if (!profilePlans[key]) profilePlans[key] = {name: key, professionnels: 0, utilisateurs: 0, revenus: 0};
     profilePlans[key].revenus += planPriceOf(row);
   });
   const planData = Object.values(profilePlans).sort((a, b) => (b.professionnels + b.utilisateurs) - (a.professionnels + a.utilisateurs));
   const recurringRevenue = [...currentByUser.values()].reduce((sum, row) => sum + planPriceOf(row), 0);
   const revenueActivity = Array.from({length: 12}, (_, index) => {
     const date = new Date();
     date.setDate(1);
     date.setMonth(date.getMonth() - (11 - index));
     const month = date.toLocaleDateString('fr-FR', {month: 'short'}).replace('.', '');
     const sameMonth = row => { const raw = dateOf(row); const value = raw ? new Date(raw) : null; return value && !Number.isNaN(value.valueOf()) && value.getMonth() === date.getMonth() && value.getFullYear() === date.getFullYear(); };
     return {month, abonnements: paidSubscriptions.filter(sameMonth).reduce((sum, row) => sum + planPriceOf(row), 0), commandes: paidOrders.filter(sameMonth).reduce((sum, row) => sum + amountOf(row), 0), réservations: paidReservations.filter(sameMonth).reduce((sum, row) => sum + amountOf(row), 0)};
   });
   const activity = Array.from({length: 12}, (_, index) => {
     const date = new Date();
     date.setDate(1);
     date.setMonth(date.getMonth() - (11 - index));
     const month = date.toLocaleDateString('fr-FR', {month: 'short'}).replace('.', '');
     const sameMonth = row => { const raw = dateOf(row); const value = raw ? new Date(raw) : null; return value && !Number.isNaN(value.valueOf()) && value.getMonth() === date.getMonth() && value.getFullYear() === date.getFullYear(); };
     return {month, utilisateurs: users.filter(sameMonth).length, styles: styles.filter(sameMonth).length, réservations: reservations.filter(sameMonth).length, annonces: listings.filter(sameMonth).length};
   });
   const categoryMap = styles.reduce((acc, style) => { const key = style.category || 'Sans catégorie'; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
   const categoryData = Object.entries(categoryMap).sort(([,a],[,b]) => b - a).slice(0, 7).map(([name, value]) => ({name, value}));
   const reservationStatusMap = reservations.reduce((acc, row) => { const key = statusOf(row) || 'non renseigné'; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
   const reservationStatusData = Object.entries(reservationStatusMap).map(([name, value]) => ({name: name.replaceAll('_', ' '), value}));
   const dataSourcesFailed = requests.filter(result => result.status === 'rejected').length;
   setData({stats, users, professionals, listings, reservations, services, styles, orders, subscriptions, activeServices, publishedStyles, activeListings, pendingReservations, pendingProfessionals, professionalCount, individualCount, activeSubscriptions, currentSubscribers: currentByUser.size, paidSubscriptions, paidOrders, paidReservations, subscriptionRevenue, orderRevenue, reservationRevenue, revenue, recurringRevenue, planData, revenueActivity, activity, categoryData, reservationStatusData, dataSourcesFailed});
   setError(dataSourcesFailed ? `${dataSourcesFailed} source(s) n’ont pas pu être chargée(s). Les indicateurs disponibles restent affichés.` : '');
   setLoading(false);
 },[]);
 useEffect(()=>{
   load();
   const refresh=()=>{if(document.visibilityState==='visible')load();};
   window.addEventListener('focus',refresh);
   const timer=setInterval(refresh,30000);
   return()=>{window.removeEventListener('focus',refresh);clearInterval(timer);};
 },[load]);
 const totalUsers = data?.users.length || data?.stats?.users || 0;
 const totalStyles = data?.styles.length || data?.stats?.styles || 0;
 const totalReservations = data?.reservations.length || data?.stats?.reservations || 0;
 const reservationStatus = data?.reservationStatusData || [];
 const planData = data?.planData || [];
 const revenueActivity = data?.revenueActivity || [];
 return <section className="space-y-5">
   <Heading title="Vue globale de BeautyBook" load={load} loading={loading}>Un cockpit opérationnel pour suivre l’audience, les professionnels, les contenus, les réservations et le marché immobilier.</Heading>
   <ErrorBox error={error} retry={load}/>

   <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
     <DashboardKpi label="Comptes utilisateurs" value={number(totalUsers)} hint={`${number(data?.individualCount)} particuliers estimés`} Icon={Users} tone="indigo" />
     <DashboardKpi label="Salons professionnels" value={number(data?.professionalCount)} hint={`${number(data?.pendingProfessionals.length)} demande(s) en attente`} Icon={Building2} tone="orange" />
     <DashboardKpi label="Annonces immobilières" value={number(data?.activeListings.length || data?.stats?.listings)} hint={`${number(data?.listings.length)} annonces au total`} Icon={Home} tone="emerald" />
     <DashboardKpi label="Réservations" value={number(totalReservations)} hint={`${number(data?.pendingReservations.length)} rendez-vous à traiter`} Icon={CalendarDays} tone="rose" />
     <DashboardKpi label="Styles publiés" value={number(data?.publishedStyles.length || data?.stats?.styles)} hint={`${percent(data?.publishedStyles.length, totalStyles)} du catalogue`} Icon={Scissors} tone="orange" />
     <DashboardKpi label="Services actifs" value={number(data?.activeServices.length || data?.stats?.services)} hint={`${number(data?.services.length)} services référencés`} Icon={Package} tone="indigo" />
     <DashboardKpi label="Réels publiés" value={number(data?.stats?.reels)} hint="Contenus visibles dans le fil" Icon={Activity} tone="emerald" />
     <DashboardKpi label="Lives actifs" value={number(data?.stats?.lives_actifs)} hint="Sessions en direct maintenant" Icon={ArrowUpRight} tone="slate" />
     <DashboardKpi label="Chiffre d’affaires total" value={money(data?.revenue)} hint="Abonnements, commandes et réservations payés" Icon={CreditCard} tone="emerald" />
     <DashboardKpi label="Revenus récurrents estimés" value={money(data?.recurringRevenue)} hint="Abonnements actifs uniquement" Icon={TrendingUp} tone="indigo" />
     <DashboardKpi label="Abonnements actifs" value={number(data?.currentSubscribers)} hint={`${number(data?.activeSubscriptions.length)} enregistrements actifs`} Icon={ShieldCheck} tone="orange" />
     <DashboardKpi label="Commandes payées" value={number(data?.paidOrders.length)} hint={money(data?.orderRevenue)} Icon={Package} tone="rose" />
   </div>

   <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
     <DashboardCard title="Chiffre d’affaires dans le temps" subtitle="Montants encaissés par source et par mois">
       <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={revenueActivity} margin={{top: 8, right: 10, left: -20, bottom: 0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/><XAxis dataKey="month" tick={{fontSize: 10}} tickLine={false} axisLine={false}/><YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false}/><Tooltip content={<ChartTooltip/>}/><Legend wrapperStyle={{fontSize: 11}}/><Bar dataKey="abonnements" name="Abonnements (€)" stackId="revenue" fill="#ff7a00" radius={[0,0,0,0]}/><Bar dataKey="commandes" name="Commandes (€)" stackId="revenue" fill="#4f46e5"/><Bar dataKey="réservations" name="Réservations (€)" stackId="revenue" fill="#10b981" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></div>
       <div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-orange-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-orange-600">Abonnements</p><p className="mt-1 text-lg font-black text-slate-900">{money(data?.subscriptionRevenue)}</p></div><div className="rounded-xl bg-indigo-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Commandes</p><p className="mt-1 text-lg font-black text-slate-900">{money(data?.orderRevenue)}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Réservations</p><p className="mt-1 text-lg font-black text-slate-900">{money(data?.reservationRevenue)}</p></div></div>
     </DashboardCard>
     <DashboardCard title="Mix des abonnements" subtitle="Professionnels et utilisateurs actifs">
       <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={planData.length ? planData : [{name:'Aucune donnée', professionnels:0, utilisateurs:0}]} margin={{top: 8, right: 10, left: -20, bottom: 28}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/><XAxis dataKey="name" angle={-20} textAnchor="end" tick={{fontSize: 9}} tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tick={{fontSize: 10}} tickLine={false} axisLine={false}/><Tooltip content={<ChartTooltip/>}/><Legend wrapperStyle={{fontSize: 10}}/><Bar dataKey="professionnels" name="Professionnels" fill="#ff7a00" radius={[6,6,0,0]} barSize={20}/><Bar dataKey="utilisateurs" name="Utilisateurs" fill="#4f46e5" radius={[6,6,0,0]} barSize={20}/></BarChart></ResponsiveContainer></div>
     </DashboardCard>
   </div>

   <DashboardCard title="Détail des abonnements" subtitle="Nombre de professionnels, utilisateurs et revenus estimés par formule">
     <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400"><th className="pb-3 font-bold">Formule</th><th className="pb-3 font-bold">Prix mensuel</th><th className="pb-3 font-bold">Professionnels</th><th className="pb-3 font-bold">Utilisateurs</th><th className="pb-3 font-bold">Revenus récurrents</th><th className="pb-3 text-right font-bold">Part du parc</th></tr></thead><tbody>{(planData.length ? planData : [{name:'Aucune donnée',professionnels:0,utilisateurs:0,revenus:0}]).map(plan => { const totalPlan = plan.professionnels + plan.utilisateurs; const totalSubscribers = planData.reduce((sum, item) => sum + item.professionnels + item.utilisateurs, 0); return <tr key={plan.name} className="border-b border-slate-100 last:border-0"><td className="py-3 font-black text-slate-800">{plan.name}</td><td className="py-3 text-slate-600">{money(PLAN_PRICES[plan.name.toLowerCase()] || 0)}/mois</td><td className="py-3 font-semibold text-orange-600">{number(plan.professionnels)}</td><td className="py-3 font-semibold text-indigo-600">{number(plan.utilisateurs)}</td><td className="py-3 font-semibold text-emerald-600">{money(plan.revenus)}</td><td className="py-3 text-right font-bold text-slate-500">{percent(totalPlan, totalSubscribers)}</td></tr>;})}</tbody></table></div>
   </DashboardCard>

   <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
     <DashboardCard title="Activité mensuelle" subtitle="Créations enregistrées sur les 12 derniers mois">
       <div className="h-[290px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data?.activity || []} margin={{top: 8, right: 10, left: -20, bottom: 0}}><defs><linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25}/><stop offset="100%" stopColor="#4f46e5" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/><XAxis dataKey="month" tick={{fontSize: 10}} tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tick={{fontSize: 10}} tickLine={false} axisLine={false}/><Tooltip content={<ChartTooltip/>}/><Legend wrapperStyle={{fontSize: 11}}/><Area type="monotone" dataKey="utilisateurs" name="Utilisateurs" stroke="#4f46e5" fill="url(#usersGradient)" strokeWidth={2}/><Area type="monotone" dataKey="styles" name="Styles" stroke="#ff7a00" fill="transparent" strokeWidth={2}/><Area type="monotone" dataKey="réservations" name="Réservations" stroke="#10b981" fill="transparent" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>
     </DashboardCard>
     <DashboardCard title="Répartition de l’écosystème" subtitle="Principaux objets suivis">
       <div className="h-[290px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{name:'Particuliers',value:data?.individualCount||0},{name:'Pros',value:data?.professionalCount||0},{name:'Annonces',value:data?.activeListings.length||0},{name:'Styles',value:data?.publishedStyles.length||0}]} layout="vertical" margin={{top: 5, right: 18, left: 10, bottom: 5}}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/><XAxis type="number" allowDecimals={false} hide/><YAxis type="category" dataKey="name" width={75} tick={{fontSize: 10}} tickLine={false} axisLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="value" name="Volume" radius={[0, 7, 7, 0]} fill="#ff7a00" barSize={22}/></BarChart></ResponsiveContainer></div>
     </DashboardCard>
   </div>

   <div className="grid gap-5 xl:grid-cols-3">
     <DashboardCard title="Réservations par statut" subtitle="Tension opérationnelle">
       <div className="h-[230px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={reservationStatus.length ? reservationStatus : [{name:'Aucune donnée',value:1}]} dataKey="value" nameKey="name" innerRadius={56} outerRadius={82} paddingAngle={3}>{(reservationStatus.length ? reservationStatus : [{name:'Aucune donnée',value:1}]).map((entry,index)=><Cell key={entry.name} fill={reservationStatus.length ? CHART_COLORS[index % CHART_COLORS.length] : '#cbd5e1'}/>)}</Pie><Tooltip content={<ChartTooltip/>}/><Legend wrapperStyle={{fontSize: 10}}/></PieChart></ResponsiveContainer></div>
     </DashboardCard>
     <DashboardCard title="Styles par catégorie" subtitle="Concentration du catalogue">
       <div className="h-[230px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.categoryData || []} margin={{top: 5, right: 10, left: -20, bottom: 30}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/><XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} tick={{fontSize: 9}} tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tick={{fontSize: 10}} tickLine={false} axisLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="value" name="Styles" fill="#4f46e5" radius={[7,7,0,0]} barSize={25}/></BarChart></ResponsiveContainer></div>
     </DashboardCard>
     <DashboardCard title="Qualité et alertes" subtitle="Indicateurs à traiter en priorité">
       <div className="space-y-3">
         {[
           [data?.pendingProfessionals.length || 0, 'Demandes pro en attente', Clock3, 'text-amber-600 bg-amber-50'],
           [data?.pendingReservations.length || 0, 'Rendez-vous à confirmer', CalendarDays, 'text-rose-600 bg-rose-50'],
           [Math.max(0, totalStyles - (data?.publishedStyles.length || 0)), 'Styles en brouillon', Layers3, 'text-slate-600 bg-slate-100'],
           [data?.activeServices.length || 0, 'Services actifs', CheckCircle2, 'text-emerald-600 bg-emerald-50'],
         ].map(([value,label,Icon,tone])=><div key={label} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon size={17}/></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-700">{label}</p><p className="text-[10px] text-slate-400">Suivi en temps réel</p></div><strong className="text-lg text-slate-900">{number(value)}</strong></div>)}
       </div>
     </DashboardCard>
   </div>

   <DashboardCard title="Lecture décisionnelle" subtitle="Ratios utiles pour orienter les prochaines actions">
     <div className="grid gap-4 md:grid-cols-3">
       {[["Taux de publication des styles",percent(data?.publishedStyles.length,totalStyles),"Publier les brouillons qualifiés"],["Taux de services actifs",percent(data?.activeServices.length,data?.services.length),"Réactiver les services en pause"],["Part des professionnels",percent(data?.professionalCount,totalUsers),"Convertir les comptes particuliers"]].map(([label,value,action])=><div key={label} className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-slate-700">{label}</p><BarChart3 size={16} className="text-primary"/></div><p className="mt-2 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-[10px] text-slate-400">Action : {action}</p></div>)}
     </div>
   </DashboardCard>
 </section>;
}

export function Operations(){
 const state=useRecords('bb_outbox'),[health,setHealth]=useState(null);
 useEffect(()=>{api.get('/admin/health').then(setHealth).catch(e=>state.setError(e.message));},[]);
 return <section><Heading title="État des traitements" {...state}>Notifications, paiements et événements métier enregistrés par le serveur.</Heading><ErrorBox error={state.error} retry={state.load}/>{health&&<p className="mb-5 rounded-xl border bg-white p-5">Base de données : {health.database.ok?'connectée':'indisponible'} · {health.database.latency_ms} ms</p>}<div className="space-y-3">{state.rows?.map(row=><article key={row.id} className="flex flex-wrap justify-between gap-4 rounded-xl border bg-white p-4"><div><strong>{row.topic}</strong><p className="mt-1 text-xs text-gray-500">{new Date(row.created_at).toLocaleString('fr-FR')}</p></div><div><p>{row.status} · {row.attempts} tentative(s)</p>{row.last_error_code&&<p className="text-red-700">{row.last_error_code}</p>}</div></article>)}</div>{state.rows?.length===0&&<p>Aucun traitement enregistré.</p>}</section>;
}
