import BeautyImage from '@/components/ui/BeautyImage';
import {useEffect,useState} from 'react';
import {Clock,Loader2,Trash2} from 'lucide-react';
import {apiClient} from '@/lib/apiClient';
import {useAuth} from '@/lib/AuthContext';
import {watchImageJobHistory} from '@/lib/imageJobHistory';
const labels={queued:'En attente',processing:'Génération en cours',completed:'Terminé',failed:'Échec',uncertain:'Résultat non confirmé'};
const types={hair:'Style',article:'Article seul',outfit:'Tenue complète',exchange:'Échange'};
export default function ImageJobHistory({onSelect,onClose,kinds=''}){
 const {user,isLoadingAuth,navigateToLogin}=useAuth();
 const [retry,setRetry]=useState(0),[authRequired,setAuthRequired]=useState(false);
 const [jobs,setJobs]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[deleting,setDeleting]=useState('');
 const [filter,setFilter]=useState(''),[limit,setLimit]=useState(20),[hasMore,setHasMore]=useState(false);
 useEffect(()=>{
  setJobs([]);setHasMore(false);setError('');setAuthRequired(false);
  setLoading(isLoadingAuth||Boolean(user?.id));
  if(isLoadingAuth)return;
  if(!user?.id){setAuthRequired(true);setError('Connectez-vous pour consulter votre historique privé.');return;}
  const query=new URLSearchParams({limit:String(limit),kinds:filter||kinds||Object.keys(types).join(',')});
  return watchImageJobHistory(apiClient.request.bind(apiClient),query,{
   onData:result=>{setJobs(result.jobs);setHasMore(result.has_more);setError('');},
   onError:e=>{setError(e.message);if(e.status===401||e.status===403){setAuthRequired(e.status===401);setJobs([]);setHasMore(false);}},
   onSettled:()=>setLoading(false),
  });
 },[filter,kinds,limit,user?.id,isLoadingAuth,retry]);
 async function remove(id){setDeleting(id);try{await apiClient.delete('/api/image-jobs/'+id);setJobs(old=>old.filter(j=>j.id!==id));}catch(e){setError(e.message);}finally{setDeleting('');}}
 return <section className="w-full min-w-0 max-w-full p-4 space-y-3 break-words" aria-label="Historique privé des générations">
  <header className="flex gap-2 justify-between items-center"><h2 className="min-w-0 flex-1 text-base font-bold">Historique des générations</h2>{onClose&&<button onClick={onClose} className="shrink-0 min-h-11 px-3 text-primary font-semibold">Fermer</button>}</header>
  <p className="text-xs text-gray-500">Résultats privés, disponibles après avoir quitté la page. Ouvrez une image pour la consulter ou la télécharger.</p>
  <div className="flex gap-2 overflow-x-auto">{['',...(kinds?kinds.split(','):Object.keys(types))].map(kind=><button key={kind} aria-pressed={filter===kind} onClick={()=>{setFilter(kind);setLimit(20);}} className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-bold ${filter===kind?'bg-primary text-white':'bg-gray-100 text-gray-600'}`}>{types[kind]||'Tout'}</button>)}</div>
  {error&&<p role="alert" className="text-sm text-red-700 bg-red-50 rounded-xl p-3">{error}</p>}
  {error&&<button onClick={authRequired?navigateToLogin:()=>setRetry(value=>value+1)} className="min-h-11 px-4 rounded-xl bg-primary text-white font-semibold">{authRequired?'Se reconnecter':'Réessayer'}</button>}
  {loading?<p role="status" className="flex gap-2 py-6"><Loader2 className="animate-spin"/>Chargement…</p>:!jobs.length&&!error?<p className="py-8 text-gray-500 flex items-center gap-2"><Clock/>Aucune génération enregistrée.</p>:jobs.map(job=><article key={job.id} className="rounded-2xl border border-gray-200 p-3 flex items-center gap-3">
   <button disabled={!job.result_url} onClick={()=>onSelect?.(job.result_url,job)} className="flex items-center gap-3 text-left flex-1 min-w-0">
    {job.result_url?<BeautyImage src={job.result_url} alt={job.label} className="w-20 h-24 shrink-0 rounded-xl object-cover"/>:<div className="w-20 h-24 shrink-0 rounded-xl bg-gray-100 grid place-items-center"><Clock className="text-gray-400"/></div>}
    <span className="min-w-0"><span className="block text-[10px] font-bold text-primary">{types[job.kind]}</span><span className="block font-semibold text-sm truncate">{job.label}</span><span className="block text-xs text-gray-500 mt-1">{labels[job.status]} · {new Date(job.created_at).toLocaleString('fr-FR')}</span>{job.message&&<span className="block text-xs text-gray-500 mt-1">{job.message}</span>}</span>
   </button>
   <button title={job.status==='processing'?'Disponible à la fin du traitement':'Supprimer cette génération'} aria-label="Supprimer cette génération" disabled={job.status==='processing'||deleting===job.id} onClick={()=>remove(job.id)} className="min-h-11 min-w-11 grid place-items-center rounded-full text-gray-500 disabled:opacity-30"><Trash2 className="h-4 w-4"/></button>
  </article>)}
  {hasMore&&limit<200&&<button onClick={()=>setLimit(value=>Math.min(200,value+20))} className="min-h-11 w-full rounded-xl border text-primary font-bold">Voir plus</button>}
 </section>;
}
