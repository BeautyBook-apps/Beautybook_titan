import {ApiError} from './apiTransport.js';

export function waitForPoll(ms,signal){return new Promise((resolve,reject)=>{
 if(signal?.aborted)return reject(new DOMException('Suivi fermé.','AbortError'));
 const onAbort=()=>{clearTimeout(timer);reject(new DOMException('Suivi fermé.','AbortError'));};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',onAbort);resolve();},ms);
 signal?.addEventListener('abort',onAbort,{once:true});
});}

export async function requestImageJob(request,payload,{signal,idempotencyKey=crypto.randomUUID(),onProgress,pollMs=4000,wait=waitForPoll,maxWaitMs=600000,maxReadRetries=6,maxCreateRetries=2}={}){
 signal?.throwIfAborted();
 let job;
 for(let attempt=0;;attempt++){
  try{
   job=await request('/api/ai/try-on',{method:'POST',headers:{'Idempotency-Key':idempotencyKey},body:JSON.stringify(payload),signal});
   break;
  }catch(error){
   signal?.throwIfAborted();
   if(error.name==='AbortError')throw error;
   const transient=error.status===0||error.status===502||error.status===504||['NETWORK_ERROR','BACKEND_UNAVAILABLE'].includes(error.code);
   if(!transient||attempt>=maxCreateRetries)throw error;
   await wait(2000,signal);
  }
 }

 const started=Date.now();
 let readFailures=0;
 const pending=()=>{
  const error=new ApiError('Le suivi est temporairement indisponible. Votre demande reste enregistrée : ouvrez l’historique pour récupérer le résultat sans relancer la génération.',202,'IMAGE_PENDING');
  error.jobId=job.id;
  return error;
 };
 while(true){
  signal?.throwIfAborted();onProgress?.(job);
  if(job.status==='completed'&&job.result_url)return job;
  if(['failed','uncertain','deleted'].includes(job.status))throw new ApiError(job.message||'La génération n’a pas abouti.',502,job.error_code||'IMAGE_GENERATION_FAILED');
  if(Date.now()-started>=maxWaitMs)throw pending();
  if(!['queued','processing'].includes(job.status)||!job.id)throw new ApiError('Réponse de génération invalide.',502,'INVALID_RESPONSE');
  await wait(pollMs,signal);
  signal?.throwIfAborted();
  try {
   job=await request('/api/image-jobs/'+job.id,{method:'GET',signal});
   readFailures=0;
  } catch(error) {
   signal?.throwIfAborted();
   if(error.name==='AbortError')throw error;
   const retryable=error.status===0||error.status===429||error.status>=500||error.code==='NETWORK_ERROR';
   if(!retryable)throw error;
   if(++readFailures>=maxReadRetries)throw pending();
   onProgress?.({...job,reconnecting:true});
   // Retry only this read. Never resubmit the already accepted paid job.
  }
 }
}
