import {ApiError} from './apiTransport.js';

export function waitForPoll(ms,signal){return new Promise((resolve,reject)=>{
 if(signal?.aborted)return reject(new DOMException('Suivi fermé.','AbortError'));
 const onAbort=()=>{clearTimeout(timer);reject(new DOMException('Suivi fermé.','AbortError'));};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',onAbort);resolve();},ms);
 signal?.addEventListener('abort',onAbort,{once:true});
});}

export async function requestImageJob(request,payload,{signal,idempotencyKey=crypto.randomUUID(),onProgress,pollMs=4000,wait=waitForPoll,maxWaitMs=240000}={}){
 signal?.throwIfAborted();
 let job=await request('/api/ai/try-on',{method:'POST',headers:{'Idempotency-Key':idempotencyKey},body:JSON.stringify(payload),signal});

 const started=Date.now();
 while(true){
  signal?.throwIfAborted();onProgress?.(job);
  if(job.status==='completed'&&job.result_url)return job;
  if(['failed','uncertain','deleted'].includes(job.status))throw new ApiError(job.message||'La génération n’a pas abouti.',502,job.error_code||'IMAGE_GENERATION_FAILED');
  if(Date.now()-started>=maxWaitMs)throw new ApiError('Le traitement continue. Retrouvez votre demande dans l’historique des essayages.',202,'IMAGE_PENDING');
  if(!['queued','processing'].includes(job.status)||!job.id)throw new ApiError('Réponse de génération invalide.',502,'INVALID_RESPONSE');
  await wait(pollMs,signal);
  signal?.throwIfAborted();
  job=await request('/api/image-jobs/'+job.id,{method:'GET',signal});
 }
}
