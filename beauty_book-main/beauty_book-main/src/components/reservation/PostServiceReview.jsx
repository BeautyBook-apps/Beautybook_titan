import {useEffect,useState} from 'react';
import {Star,X,Loader2,CheckCircle2} from 'lucide-react';
import {entities} from '@/api/entities';
import {supabase} from '@/api/supabaseClient';

const labels={ponctualite:'Ponctualité',communication:'Communication',proprete:'Propreté et hygiène'};
function Stars({value,onChange,label}){
 return <div className="flex gap-1" role="group" aria-label={label}>{[1,2,3,4,5].map(n=><button key={n} type="button" aria-label={`${n} sur 5 — ${label}`} aria-pressed={n===value} onClick={()=>onChange(n)} className="min-h-11 min-w-11 flex items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><Star className={`h-7 w-7 ${n<=value?'fill-primary text-primary':'text-gray-300'}`}/></button>)}</div>;
}
export default function PostServiceReview({reservation,proEmail,proName,onClose,onSubmitted}){
 const [existing,setExisting]=useState(null),[note,setNote]=useState(0),[commentaire,setCommentaire]=useState(''),[criteres,setCriteres]=useState({}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 useEffect(()=>{let active=true;(async()=>{try{
  const {data:{user},error:authError}=await supabase.auth.getUser();if(authError)throw authError;if(!user)throw new Error('Connectez-vous pour laisser un avis.');
  const {data,error:queryError}=await supabase.from('Avis').select('*').eq('reservation_id',reservation.id).eq('auteur_email',user.email).maybeSingle();if(queryError)throw queryError;
  if(active&&data){setExisting(data);setNote(Number(data.note??data.rating));setCommentaire(data.commentaire??data.comment??'');setCriteres(data.criteres||{});}
 }catch(e){if(active)setError(e.message||'Impossible de charger votre avis.');}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[reservation.id]);
 async function save(e){e.preventDefault();if(!note||saving)return;setSaving(true);setError('');try{
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError)throw authError;
  if(!user?.id||!user.email)throw new Error('Connectez-vous pour laisser un avis.');
  const input={note:Number(note),commentaire:commentaire.trim(),criteres:criteres&&typeof criteres==='object'?criteres:{},images:[]};
  const review=existing?await entities.Avis.update(existing.id,input):await entities.Avis.create({
   ...input,
   reservation_id:reservation.id,
   type:'client_to_pro',
   auteur_email:user.email,
   auteur_nom:user.user_metadata?.full_name||user.email,
   created_by_id:user.id,
   status:'published',
   cible_email:proEmail||reservation.pro_email,
   cible_nom:proName||reservation.pro_name||'',
   service_nom:reservation.service_name||'',
  });
  setExisting(review);setDone(true);onSubmitted?.(review);
 }catch(e){console.error('[PostServiceReview] Avis create failed',e);setError(e.message||e.details||'Votre avis n’a pas été enregistré. Réessayez.');}finally{setSaving(false);}}
 return <div className="fixed inset-0 z-[300] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="review-title" className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92dvh] overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
  <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Votre expérience</p><h2 id="review-title" className="text-2xl font-bold mt-1">{done?'Merci pour votre avis':existing?'Modifier mon avis':'Comment s’est passé votre rendez-vous ?'}</h2><p className="text-sm text-gray-500 mt-2">{reservation.service_name} · {proName||reservation.pro_name}</p></div><button type="button" onClick={onClose} aria-label="Fermer" className="min-h-11 min-w-11 rounded-full bg-gray-100 flex items-center justify-center"><X className="h-5 w-5"/></button></header>
  {error&&<p role="alert" className="my-4 rounded-xl bg-red-50 text-red-800 text-sm p-3">{error}</p>}
  {loading?<div role="status" className="py-12 flex justify-center gap-2"><Loader2 className="animate-spin"/>Chargement de votre avis…</div>:done?<div className="py-8"><CheckCircle2 className="h-10 w-10 text-primary mb-4"/><p>Votre avis a été enregistré et la note du salon a été mise à jour.</p><button onClick={onClose} className="mt-6 min-h-12 w-full rounded-xl bg-primary text-white font-semibold">Terminer</button></div>:<form onSubmit={save} className="mt-6 space-y-5"><div><p className="text-sm font-semibold mb-2">Votre note globale</p><Stars label="Note globale" value={note} onChange={setNote}/></div><label className="block text-sm font-semibold">Votre commentaire<textarea value={commentaire} onChange={e=>setCommentaire(e.target.value)} maxLength={4000} rows={4} placeholder="Accueil, résultat, conseils… Partagez votre expérience." className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal focus:outline-primary"/></label><details className="rounded-xl border border-gray-200 p-3"><summary className="cursor-pointer text-sm font-medium min-h-8">Ajouter des précisions (facultatif)</summary>{Object.entries(labels).map(([key,label])=><div key={key} className="mt-3"><p className="text-sm text-gray-600">{label}</p><Stars label={label} value={criteres[key]||0} onChange={v=>setCriteres({...criteres,[key]:v})}/></div>)}</details><p className="text-xs text-gray-500">Votre avis sera visible sur le profil du professionnel avec votre nom. Seuls les participants d’un rendez-vous terminé peuvent publier un avis.</p><button disabled={!note||saving||loading} className="min-h-12 w-full rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{saving&&<Loader2 className="h-4 w-4 animate-spin"/>}{saving?'Enregistrement…':existing?'Enregistrer les modifications':'Publier mon avis'}</button></form>}
 </section></div>;
}
