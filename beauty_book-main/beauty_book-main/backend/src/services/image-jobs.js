import {createHash} from 'node:crypto';
import db from '../config/pg.js';
import {getSupabaseAdmin} from '../config/supabase.js';
import {assert,HttpError} from '../lib/errors.js';
import {checkedImage,openaiRequest} from './openai.js';
import {isXaiConfigured,xaiImageEdit} from './xai.js';
import {isMuseConfigured,museImageEdit,museImagePrompt} from './muse.js';
import {isFalConfigured,falMuseImageEdit} from './fal.js';
import {aiCredits} from './ai-credits.js';
import {resolveSimulationCategory} from '../../../shared/simulationCategories.js';

export function imageInput(input){
 const kind=input.mode||'article';
 assert(['hair','article','outfit','exchange'].includes(kind),400,'INVALID_IMAGE_MODE','Choisissez une coiffure, un article ou une tenue.');
 const label=String(input.garment_name||input.styleName||'Essayage').trim().slice(0,240);
 const images=[checkedImage(input.user_photo||input.photoUrl)];
 const providedReferences=Array.isArray(input.reference_images)
  ?input.reference_images.filter(Boolean).slice(0,8)
  :[];
 const references=kind==='outfit'
  ?Object.values(input.outfit_pieces||{}).filter(Boolean).slice(0,8)
  :providedReferences.length>0
    ?providedReferences
    :[input.garment_photo||input.referenceImage].filter(Boolean);
 assert(references.length>=1&&references.length<=8,400,'REFERENCE_REQUIRED','Ajoutez une image de référence.');
 for(const reference of references)images.push(checkedImage(reference));
 assert(images.join('').length<=10*1024*1024,413,'IMAGES_TOO_LARGE','Les images sont trop volumineuses.');
 const items=kind==='outfit'?Object.keys(input.outfit_pieces||{}).filter(key=>input.outfit_pieces[key]).slice(0,8):[];
 const simulation=kind==='hair'?resolveSimulationCategory({category:input.category||'coiffure',subcategory:input.subcategory,serviceCategory:input.service_category}):null;
 if(simulation)assert(simulation.supported,400,'SIMULATION_CATEGORY_UNSUPPORTED','Choisissez une catégorie avec une transformation visuelle précise.');
 return {
  kind,label,images,items,
  module:input.module|| (kind==='outfit'?'styliste_ia':'ai_style_changer'),
  page:input.page||'sh-ai',
  category:simulation?.id||input.category||'all',
  subcategory:input.subcategory||null,
  target_area:simulation?.target||input.target_area||input.targetArea||'not specified',
  operation:input.operation|| (kind==='outfit'?'outfit_styling':'style_change'),
 };
}
function promptFor(input){
 return museImagePrompt(input)+' Produce one realistic edited image. Keep the original framing and clothing. Do not add a body or face when the source is a close-up.';
}
function decodeImageResult(response){
 const item=response?.data?.[0];
 assert(typeof item?.b64_json==='string'&&item.b64_json.length<=24*1024*1024,502,'INVALID_IMAGE_RESULT','Le fournisseur n’a pas renvoyé une image exploitable.');
 const bytes=Buffer.from(item.b64_json,'base64');
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 const webp=bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP';
 assert(bytes.length>8&&(png||jpeg||webp),502,'INVALID_IMAGE_RESULT','Format du résultat invalide.');
 return {bytes,contentType:png?'image/png':jpeg?'image/jpeg':'image/webp'};
}
export const imageStorage={
 async save(path,bytes,contentType='image/png'){const {error}=await getSupabaseAdmin().storage.from('ai-results').upload(path,bytes,{contentType,upsert:false});assert(!error,502,'IMAGE_STORAGE_FAILED','Le résultat n’a pas pu être enregistré.');},
 async url(path){const {data,error}=await getSupabaseAdmin().storage.from('ai-results').createSignedUrl(path,3600);assert(!error&&data?.signedUrl,502,'IMAGE_STORAGE_FAILED','Le résultat n’est pas accessible.');return data.signedUrl;},
 async exists(path){const {data,error}=await getSupabaseAdmin().storage.from('ai-results').download(path);if(error){if(['404','400'].includes(String(error.statusCode)))return false;throw new HttpError(502,'IMAGE_STORAGE_FAILED','Le stockage ne répond pas.');}return data?.size>0;},
 async remove(path){const {error}=await getSupabaseAdmin().storage.from('ai-results').remove([path]);assert(!error,502,'IMAGE_STORAGE_FAILED','La suppression du résultat a échoué.');},
};
function provider(input = null) {
 const configured=String(process.env.AI_IMAGE_PROVIDER||'').toLowerCase();
 // Hairstyle and Styliste IA must stay on the configured image service whenever
 // the server has the required credentials, even if an older deployment still
 // has a legacy provider setting.
 if(isFalConfigured() && (
   ['hair','outfit'].includes(input?.kind || '')
   || ['ai_style_changer','styliste_ia'].includes(input?.module || '')
 ))return 'fal';
 if(configured==='fal')return 'fal';
 if(configured==='muse')return 'muse';
 if(configured==='openai')return 'openai';
 if(configured==='grok'||configured==='xai')return 'grok';
 return isFalConfigured()?'fal':isMuseConfigured()?'muse':isXaiConfigured()?'grok':'openai';
}
export function createImageJobs(database=db,{storage=imageStorage,configured=()=>provider()==='fal'?isFalConfigured():provider()==='muse'?isMuseConfigured():provider()==='grok'?isXaiConfigured():!!process.env.OPENAI_API_KEY,generate,billing=aiCredits}={}){
 let runner=null,runnerStopping=false;
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const generateImage=generate||(async(input)=>{
  const selectedProvider=provider(input);
  if(selectedProvider==='fal')return falMuseImageEdit({images:input.images,prompt:promptFor(input)});
  if(selectedProvider==='muse')return museImageEdit({images:input.images,prompt:promptFor(input)});
  if(selectedProvider==='grok')return xaiImageEdit({images:input.images,prompt:promptFor(input)});
  return openaiRequest('images/edits',{model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-2.5-flare',images:input.images.map(image_url=>({image_url})),prompt:promptFor(input),n:1,size:'1024x1024',quality:'medium',output_format:'png',moderation:'auto'},{timeoutMs:180000});
 });
 async function present(row){
  const result={id:row.id,status:row.status,kind:row.kind,label:row.label,created_at:row.created_at,error_code:row.error_code};
  if(row.status==='completed'&&row.output_path)result.result_url=await storage.url(row.output_path);
  if(row.status==='failed')result.message=row.error_code==='FAL_NOT_CONFIGURED'
   ?'Le service de génération n’est pas configuré sur le serveur. Redémarrez le backend après avoir configuré ses identifiants.'
   :['FAL_PROVIDER_ERROR','FAL_NETWORK_ERROR','FAL_TIMEOUT','FAL_IMAGE_UNAVAILABLE','MUSE_BILLING_REQUIRED','MUSE_ACCESS_DENIED','MUSE_PROVIDER_ERROR'].includes(row.error_code)
    ?'Le service de génération n’a pas pu créer cette image. Vérifiez la connexion du serveur puis réessayez.'
    :'La génération a échoué. Aucun résultat n’a été créé.';
  if(row.status==='uncertain')result.message='Le fournisseur n’a pas confirmé le résultat. La génération ne sera pas relancée automatiquement.';
  return result;
 }
 async function create(user,payload,key){
  assert(user?.id,401,'AUTH_REQUIRED','Connectez-vous pour créer un essayage.');
  assert(configured(),503,'AI_NOT_CONFIGURED','Le service d’essayage IA doit être configuré.');
  assert(typeof key==='string'&&/^[A-Za-z0-9_-]{16,100}$/.test(key),400,'IDEMPOTENCY_REQUIRED','Identifiant de génération manquant.');
  const input=imageInput(payload),hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const row=await database.transaction(async client=>{
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['image-quota:'+user.id]);
   const {rows:[previous]}=await client.query('SELECT * FROM bb_image_jobs WHERE user_id=$1 AND request_key=$2',[user.id,key]);
   if(previous){assert(previous.request_hash===hash,409,'IDEMPOTENCY_CONFLICT','Cet identifiant correspond déjà à une autre génération.');return previous;}
   const reservation=await billing.reserve(client,user.id);
   const {rows:[job]}=await client.query('INSERT INTO bb_image_jobs(user_id,request_key,request_hash,kind,label,input,billing_source,credit_cost) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING *',[user.id,key,hash,input.kind,input.label,JSON.stringify(input),reservation.source,reservation.credit_cost]);
   await billing.recordGeneration(client,user.id,job.id,reservation);
   return job;
  });
  return present(row);
 }
 async function get(user,id){const {rows:[row]}=await database.query("SELECT * FROM bb_image_jobs WHERE id::text=$1 AND user_id=$2 AND status<>'deleted'",[id,user.id]);assert(row,404,'IMAGE_NOT_FOUND','Essayage introuvable.');return present(row);}
 async function list(user,{limit=20,kinds}={}){
  const count=Number(limit);
  assert(Number.isInteger(count)&&count>=1&&count<=200,400,'INVALID_HISTORY_LIMIT','Nombre de résultats invalide.');
  const selected=kinds?String(kinds).split(','):['hair','article','outfit','exchange'];
  assert(selected.length>0&&selected.every(kind=>['hair','article','outfit','exchange'].includes(kind)),400,'INVALID_IMAGE_MODE','Type de génération invalide.');
  const {rows}=await database.query("SELECT * FROM bb_image_jobs WHERE user_id=$1 AND status<>'deleted' AND kind=ANY($2::text[]) ORDER BY created_at DESC,id DESC LIMIT $3",[user.id,selected,count+1]);
  return {jobs:await Promise.all(rows.slice(0,count).map(present)),has_more:rows.length>count};
 }
 async function remove(user,id){return database.transaction(async client=>{
  const {rows:[row]}=await client.query('SELECT * FROM bb_image_jobs WHERE id::text=$1 AND user_id=$2 FOR UPDATE',[id,user.id]);assert(row,404,'IMAGE_NOT_FOUND','Essayage introuvable.');
  assert(row.status!=='processing',409,'IMAGE_PROCESSING','La génération a déjà commencé. Supprimez le résultat une fois le traitement terminé.');
  if(row.status==='queued')await billing.refundGeneration(client,row);
  if(row.output_path)await storage.remove(row.output_path);
  await client.query("UPDATE bb_image_jobs SET status='deleted',input='{}',output_path=NULL WHERE id=$1",[row.id]);return {deleted:true};
 });}
 async function runOne(){
  // Never retry an uncertain billable generation. Recover a deterministic saved
  // output after a worker crash, otherwise record uncertainty for the owner.
  const {rows:[stale]}=await database.query("SELECT * FROM bb_image_jobs WHERE status='processing' AND started_at<now()-interval '10 minutes' ORDER BY started_at LIMIT 1");
  if(stale){
   let path=null;
   for(const extension of ['.png','.jpg','.webp']){const candidate=stale.user_id+'/'+stale.id+extension;if(await storage.exists(candidate)){path=candidate;break;}}
   await database.query("UPDATE bb_image_jobs SET status=$1,output_path=$2,error_code=$3,input='{}',finished_at=now() WHERE id=$4 AND status='processing'",[path?'completed':'uncertain',path,path?null:'PROVIDER_RESULT_UNKNOWN',stale.id]);return true;
  }
  const row=await database.transaction(async client=>{
   const {rows:[job]}=await client.query(`SELECT queued.* FROM bb_image_jobs queued
    WHERE queued.status='queued'
      AND NOT EXISTS (
       SELECT 1 FROM bb_image_jobs active
       WHERE active.user_id=queued.user_id AND active.status='processing'
      )
    ORDER BY queued.created_at,queued.id
    FOR UPDATE SKIP LOCKED LIMIT 1`);
   if(!job)return null;
   // Multiple API/worker replicas may be alive. Serialize the final status
   // check for this owner so only one of their generations can run at once.
   const {rows:[lock]}=await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked",['image-worker:'+job.user_id]);
   if(!lock?.locked)return null;
   const {rows:[active]}=await client.query("SELECT id FROM bb_image_jobs WHERE user_id=$1 AND status='processing' LIMIT 1",[job.user_id]);
   if(active)return null;
   await client.query("UPDATE bb_image_jobs SET status='processing',started_at=now() WHERE id=$1",[job.id]);
   return job;
  });
  if(!row)return false;
  let providerReturned=false;
  try{
   const response=await generateImage(row.input);providerReturned=true;
   const {bytes,contentType}=decodeImageResult(response);
   const path=row.user_id+'/'+row.id+(contentType==='image/png'?'.png':contentType==='image/webp'?'.webp':'.jpg');await storage.save(path,bytes,contentType);
   await database.query("UPDATE bb_image_jobs SET status='completed',output_path=$1,input='{}',finished_at=now() WHERE id=$2",[path,row.id]);
  }catch(error){
   // Storage may have accepted the output before a network interruption.
   if(providerReturned&&error.code!=='INVALID_IMAGE_RESULT')return true;
   const uncertain=error.code==='AI_NETWORK_ERROR';
   await database.transaction(async client=>{
    const {rows:[current]}=await client.query('SELECT * FROM bb_image_jobs WHERE id=$1 FOR UPDATE',[row.id]);
    if(!current)return;
    await client.query("UPDATE bb_image_jobs SET status=$1,error_code=$2,input='{}',finished_at=now() WHERE id=$3",[uncertain?'uncertain':'failed',error instanceof HttpError?error.code:'IMAGE_GENERATION_FAILED',row.id]);
    if(!uncertain)await billing.refundGeneration(client,current);
   });
  }
  return true;
 }
 function start({idleMs=1500,errorMs=5000}={}){
  if(runner)return runner;
  runnerStopping=false;
  runner=(async()=>{
   while(!runnerStopping){
    try{if(!await runOne())await wait(idleMs);}
    catch(error){
     console.error(JSON.stringify({event:'image_worker_error',code:error.code||'IMAGE_WORKER_FAILED'}));
     await wait(errorMs);
    }
   }
  })().finally(()=>{runner=null;});
  return runner;
 }
 function stop(){runnerStopping=true;}
 return {create,get,list,remove,runOne,start,stop};
}
export const imageJobs=createImageJobs();
