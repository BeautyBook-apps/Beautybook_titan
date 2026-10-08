import { supabase } from '@/api/supabaseClient';
import { apiClient } from '@/lib/apiClient';
import { compressMedia } from '@/lib/compressMedia';

const checked = ({data,error}) => { if(error) throw error; return data; };
// The deployed Avis table currently exposes the canonical French column names.
// Keep the retry payload limited to those stable columns when a newer optional
// field (for example criteres or images) is not present in the schema cache.
const remoteAvisPayload = input => ({
  reservation_id: input.reservation_id,
  type: input.type,
  auteur_email: input.auteur_email,
  auteur_nom: input.auteur_nom || input.auteur_name || '',
  cible_email: input.cible_email,
  cible_nom: input.cible_nom || input.cible_name || '',
  note: Number(input.note ?? input.rating),
  commentaire: input.commentaire ?? input.comment ?? '',
  service_nom: input.service_nom || input.service_name || '',
  created_by_id: input.created_by_id,
});
const remoteAvisUpdatePayload = input => ({
  note: Number(input.note ?? input.rating),
  commentaire: input.commentaire ?? input.comment ?? '',
});
const createEntity = table => ({
  async filter(filters={},orderBy='-created_at',limit=1000){
    let query=supabase.from(table).select('*');
    for(const [key,value] of Object.entries(filters)) {
      if (value === null) query = query.is(key, null);
      else if (Array.isArray(value)) query = query.in(key, value);
      else query = query.eq(key, value);
    }
    if(orderBy) query=query.order(orderBy.replace(/^-/,'').replace('created_date','created_at').replace('updated_date','updated_at'),{ascending:!orderBy.startsWith('-')});
    return checked(await query.limit(Math.min(Math.max(Number(limit)||100,1),1000))) || [];
  },
  list(orderBy,limit){return this.filter({},orderBy,limit);},
  async get(id){return checked(await supabase.from(table).select('*').eq('id',id).maybeSingle());},
  async create(input){
    if(table==='Reservation')return (await apiClient.callFunction('createReservation',input)).data.reservation;
    const {data:{session}}=await supabase.auth.getSession();
    if(!session)throw new Error('Connectez-vous pour effectuer cette action.');
    const result=await supabase.from(table).insert(input).select().single();
    if(table==='Avis'&&result.error?.code==='PGRST204'){
      const remoteResult=await supabase.from(table).insert(remoteAvisPayload(input)).select().single();
      return checked(remoteResult);
    }
    return checked(result);
  },
  async update(id,input){
    if(table==='Reservation')return (await apiClient.put('/api/reservations/'+id,input)).reservation;
    const result=await supabase.from(table).update(input).eq('id',id).select().single();
    if(table==='Avis'&&result.error?.code==='PGRST204'){
      const remoteResult=await supabase.from(table).update(remoteAvisUpdatePayload(input)).eq('id',id).select().single();
      return checked(remoteResult);
    }
    return checked(result);
  },
  async delete(id){
    if(table==='Reservation')throw new Error('Annulez le rendez-vous depuis son détail pour conserver son historique.');
    checked(await supabase.from(table).delete().eq('id',id).select('id').single());
    return true;
  },
  subscribe(callback){
    const channel=supabase.channel('entity:'+table+':'+crypto.randomUUID()).on('postgres_changes',{event:'*',schema:'public',table},payload=>{
      const data=payload.eventType==='DELETE'?payload.old:payload.new;
      callback({type:payload.eventType==='INSERT'?'create':payload.eventType==='UPDATE'?'update':'delete',data,id:data?.id});
    }).subscribe();
    return ()=>supabase.removeChannel(channel);
  },
});

export const entities = {
  ProfilPro:          createEntity('ProfilPro'),
  Service:            createEntity('Service'),
  Reservation:        createEntity('Reservation'),
  Avis:               createEntity('Avis'),
  Style:              createEntity('Style'),
  StyleCategory:      createEntity('StyleCategory'),
  StyleSubCategory:   createEntity('StyleSubCategory'),
  Reel:               createEntity('Reel'),
  CommentaireStyle:   createEntity('CommentaireStyle'),
  MessageChat:        createEntity('MessageChat'),
  Notification:       createEntity('Notification'),
  Produit:            createEntity('Produit'),
  Commande:           createEntity('Commande'),
  Annonce:            createEntity('Annonce'),
  AppConfig:          createEntity('AppConfig'),
  CallLog:            createEntity('CallLog'),
  CallSignal:         createEntity('CallSignal'),
  CatalogueOption:    createEntity('CatalogueOption'),
  Client:             createEntity('Client'),
  DemandeProV2:       createEntity('DemandeProV2'),
  DemandefFranchise:  createEntity('DemandefFranchise'),
  ImmobilierListing:  createEntity('ImmobilierListing'),
  LiveMessage:        createEntity('LiveMessage'),
  LiveSession:        createEntity('LiveSession'),
  MariaConversation:  createEntity('MariaConversation'),
  MembreEquipe:       createEntity('MembreEquipe'),
  PointsFidelite:     createEntity('PointsFidelite'),
  PointsFidelitePro:  createEntity('PointsFidelitePro'),
  Publication:        createEntity('Publication'),
  Repub:              createEntity('Repub'),
  RoutineBeaute:      createEntity('RoutineBeaute'),
  SoldeBeautyPay:     createEntity('SoldeBeautyPay'),
  Panier:             createEntity('Panier'),
  UserSubscription:   createEntity('UserSubscription'),
  UserMemory:         createEntity('UserMemory'),
  VerificationCode:   createEntity('VerificationCode'),
  VisiteVirtuelle:    createEntity('VisiteVirtuelle'),
  Like:               createEntity('user_like'),
  Favori:             createEntity('user_favorite'),
  CommentaireReel:    createEntity('reel_comment'),
  UserFollow:         createEntity('user_follow'),
  User:               createEntity('profiles'),
  profiles:           createEntity('profiles'),
  ServiceBundle:      createEntity('ServiceBundle'),
};


export async function uploadFile(fileOrObj,bucket='uploads'){
  const raw=fileOrObj?.file instanceof File?fileOrObj.file:fileOrObj;
  if(!(raw instanceof File))throw new Error('Choisissez un fichier.');
  if(!['uploads','private-documents','private-images'].includes(bucket))throw new Error('Destination de fichier invalide.');
  const {data:{session},error:authError}=await supabase.auth.getSession().catch(()=>({data:{}}));
  const allowed=bucket==='private-images'?['image/jpeg','image/png','image/webp']:bucket==='private-documents'?['image/jpeg','image/png','image/webp','application/pdf']:['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/wav','audio/webm'];
  if(!allowed.includes(raw.type))throw new Error('Ce type de fichier n’est pas accepté.');
  const max=raw.type.startsWith('video/')?100*1024*1024:20*1024*1024;
  if(raw.size>max)throw new Error('Fichier trop volumineux (20 Mo, ou 100 Mo pour une vidéo).');
  const file=bucket==='private-documents'?raw:await compressMedia(raw);
  const extension=({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','application/pdf':'pdf','video/mp4':'mp4','video/webm':'webm','audio/mpeg':'mp3','audio/wav':'wav','audio/webm':'webm'})[file.type];
  if(!extension)throw new Error('Format de fichier non pris en charge.');
  
  const userId = session?.user?.id || 'public';
  const path=userId+'/'+crypto.randomUUID()+'.'+extension;
  
  // Use uploads bucket directly as private-images is not a provisioned bucket
  const targetBucket = (bucket === 'private-images') ? 'uploads' : bucket;
  const uploadResult = await supabase.storage.from(targetBucket).upload(path,file,{contentType:file.type,upsert:true});

  // If storage upload succeeded
  if(!uploadResult.error){
    if(targetBucket==='private-documents')return {file_url:'storage://private-documents/'+path,path,bucket:targetBucket};
    return {file_url:supabase.storage.from(targetBucket).getPublicUrl(path).data.publicUrl,path,bucket:targetBucket};
  }

  // Fallback: convert to base64 Data URL if Supabase storage is unavailable
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return {file_url: dataUrl, path, bucket: 'local'};
}

export const fetchProduits = (params={}) => entities.Produit.filter(params.status?{status:params.status}:{},'-created_at',params.limit||500);
