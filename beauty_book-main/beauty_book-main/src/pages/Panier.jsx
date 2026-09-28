import BeautyImage from '@/components/ui/BeautyImage';
import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowLeft,Minus,Plus,Trash2,ShoppingBag} from 'lucide-react';
import {apiClient} from '@/lib/apiClient';
import {supabase} from '@/api/supabaseClient';
const money=n=>Number(n).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
function localItems(){try{return JSON.parse(localStorage.getItem('bb_local_cart')||'[]');}catch{return [];}}
export default function Panier(){
 const navigate=useNavigate();
 // Affichage direct depuis le cache local : pas d'écran « chargement » si un
 // panier est déjà connu, le rafraîchissement réseau se fait en arrière-plan.
 const [items,setItems]=useState(()=>localItems()),[error,setError]=useState(''),[loading,setLoading]=useState(()=>localItems().length===0),[busy,setBusy]=useState(null),[guest,setGuest]=useState(false);
 function save(rows,local=false){setItems(rows);localStorage.setItem('bb_cart_count',String(rows.length));if(local)localStorage.setItem('bb_local_cart',JSON.stringify(rows));window.dispatchEvent(new Event('bb-cart-updated'));}
 async function load(){
  setLoading(true);setError('');
  try{
   const {data:{session}}=await supabase.auth.getSession();setGuest(!session);
   if(!session){save(localItems());return;}
   const local=localItems();
   for(const i of local){await apiClient.post('/cart',{action:'merge',item:i});localStorage.setItem('bb_local_cart',JSON.stringify(localItems().filter(row=>row.produit_id!==i.produit_id)));}
   save((await apiClient.get('/cart')).panier.items);
  }catch(e){setError(e.message);}finally{setLoading(false);}
 }
 useEffect(()=>{load();},[]);
 async function update(action,item){
  setBusy(item.produit_id);setError('');
  try{
   if(guest){
    const next=action==='remove'?items.filter(i=>i.produit_id!==item.produit_id):items.map(i=>i.produit_id===item.produit_id?{...i,quantity:Math.max(1,i.quantity+(action==='increment'?1:-1))}:i);save(next,true);
   }else save((await apiClient.post('/cart',{action,item:{produit_id:item.produit_id}})).panier.items);
  }catch(e){setError(e.message);}finally{setBusy(null);}
 }
 const subtotal=items.reduce((sum,i)=>sum+Number(i.price||0)*i.quantity,0);
 return <main className="bg-[#f6f5f2] min-h-full pb-28"><header className="flex items-center gap-4 p-5 bg-white border-b"><button className="p-3 bg-gray-100 rounded-full" aria-label="Retour" onClick={()=>navigate(-1)}><ArrowLeft size={20}/></button><h1 className="text-2xl font-bold">Mon panier</h1></header><div className="max-w-2xl mx-auto p-5 space-y-4">
  {error&&<div role="alert" className="p-4 rounded-xl bg-red-50 text-red-800">{error}<button className="block underline mt-2 min-h-11" onClick={load}>Réessayer</button></div>}
  {(loading&&items.length===0)?<p role="status">Chargement du panier…</p>:items.length===0?<section className="text-center bg-white rounded-2xl p-10"><ShoppingBag className="mx-auto mb-4" size={40}/><h2 className="text-xl font-bold">Votre panier est vide</h2><button onClick={()=>navigate('/boutique')} className="mt-5 bg-primary text-white px-5 py-3 rounded-xl">Découvrir la boutique</button></section>:<>
   {guest&&<p className="p-4 bg-white rounded-xl">Votre panier est conservé sur cet appareil. Connectez-vous pour vérifier les prix et commander.</p>}
   {items.map(i=><article key={i.produit_id} className="bg-white rounded-2xl p-4 flex gap-4">{i.image_url&&<BeautyImage className="w-20 h-24 rounded-xl object-cover" src={i.image_url} alt=""/>}<div className="flex-1 min-w-0"><h2 className="font-bold">{i.name}</h2><p className="mt-1">{i.price==null?'Prix indisponible':money(i.price*i.quantity)}</p>{i.available===false&&<p className="text-red-700 text-sm">Produit indisponible dans cette quantité</p>}<div className="flex items-center gap-3 mt-3"><button aria-label={'Diminuer la quantité de '+i.name} disabled={busy===i.produit_id||i.quantity<=1} className="p-3 border rounded-xl disabled:opacity-40" onClick={()=>update('decrement',i)}><Minus size={18}/></button><span>{i.quantity}</span><button aria-label={'Augmenter la quantité de '+i.name} disabled={busy===i.produit_id} className="p-3 border rounded-xl" onClick={()=>update('increment',i)}><Plus size={18}/></button><button aria-label={'Retirer '+i.name} disabled={busy===i.produit_id} className="p-3 ml-auto text-red-700" onClick={()=>update('remove',i)}><Trash2 size={20}/></button></div></div></article>)}
   <section className="bg-white p-5 rounded-2xl space-y-4"><div className="flex justify-between text-lg font-bold"><span>Sous-total des produits</span><span>{money(subtotal)}</span></div><p className="text-sm text-gray-500">Les frais de livraison sont calculés pour chaque boutique à l’étape suivante.</p><button className="bg-primary text-white font-bold rounded-xl w-full p-4 disabled:opacity-50" disabled={busy!==null||items.some(i=>i.available===false)} onClick={()=>navigate(guest?'/login?redirect=/panier':'/checkout')}>{guest?'Me connecter pour commander':'Continuer vers la livraison'}</button></section>
  </>}
 </div></main>;
}
