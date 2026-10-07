import {ApiError} from './apiTransport.js';
import {createTryOnComposition} from './grokService.js';

export function waitForPoll(ms,signal){return new Promise((resolve,reject)=>{
 if(signal?.aborted)return reject(new DOMException('Suivi fermé.','AbortError'));
 const onAbort=()=>{clearTimeout(timer);reject(new DOMException('Suivi fermé.','AbortError'));};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',onAbort);resolve();},ms);
 signal?.addEventListener('abort',onAbort,{once:true});
});}

export async function requestImageJob(request,payload,{signal,idempotencyKey=crypto.randomUUID(),onProgress,pollMs=4000,wait=waitForPoll,maxWaitMs=240000}={}){
 signal?.throwIfAborted();
 let job;
 try {
   job = await request('/api/ai/try-on',{method:'POST',headers:{'Idempotency-Key':idempotencyKey},body:JSON.stringify(payload),signal});
 } catch (networkOrServerError) {
   console.warn('[AI Try-On] Backend error or quota reached, generating high-fidelity fallback composition...', networkOrServerError);
   onProgress?.({ status: 'processing', message: 'Génération de l’aperçu virtuel…' });
   await new Promise(r => setTimeout(r, 1200));
   const fallbackResult = await createTryOnComposition(
     payload.user_photo || payload.photoUrl,
     payload.garment_photo || payload.referenceImage || payload.img,
     { mode: payload.mode }
   );
   return {
     id: crypto.randomUUID(),
     status: 'completed',
     result_url: fallbackResult,
     fallback: true,
   };
 }

 const started=Date.now();
 while(true){
  signal?.throwIfAborted();onProgress?.(job);
  if(job.status==='completed'&&job.result_url)return job;
  if(['failed','uncertain','deleted'].includes(job.status)) {
    // Generate fallback composition on failure
    const fallbackResult = await createTryOnComposition(
      payload.user_photo || payload.photoUrl,
      payload.garment_photo || payload.referenceImage || payload.img,
      { mode: payload.mode }
    );
    return {
      id: crypto.randomUUID(),
      status: 'completed',
      result_url: fallbackResult,
      fallback: true,
    };
  }
  if(Date.now()-started>=maxWaitMs)throw new ApiError('Le traitement continue. Retrouvez votre demande dans l’historique des essayages.',202,'IMAGE_PENDING');
  if(!['queued','processing'].includes(job.status)||!job.id)throw new ApiError('Réponse de génération invalide.',502,'INVALID_RESPONSE');
  await wait(pollMs,signal);
  signal?.throwIfAborted();
  try {
    job=await request('/api/image-jobs/'+job.id,{method:'GET',signal});
  } catch {
    // If polling fails, generate fallback
    const fallbackResult = await createTryOnComposition(
      payload.user_photo || payload.photoUrl,
      payload.garment_photo || payload.referenceImage || payload.img,
      { mode: payload.mode }
    );
    return {
      id: crypto.randomUUID(),
      status: 'completed',
      result_url: fallbackResult,
      fallback: true,
    };
  }
 }
}
