import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {backendProxy as root} from '../../../../api/_lib/backend-proxy.js';
import {backendProxy as nested} from '../../api/_lib/backend-proxy.js';
import {toNetlify} from '../../netlify/functions/_adapter.js';
import netlifyApi from '../../netlify/functions/api.js';
import engagementStats from '../../netlify/functions/engagement-stats.js';
import shopifyProducts from '../../netlify/functions/shopify-products.js';
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;},send(b){this.body=b;return this;}};}
for(const [name,proxy] of [['root',root],['nested',nested]])test(name+' proxy preserves query, signed bytes and response failure status',async()=>{
 const oldFetch=globalThis.fetch,oldBase=process.env.BEAUTYBOOK_BACKEND_URL;
 try{
  process.env.BEAUTYBOOK_BACKEND_URL='https://backend.test.invalid/api';
  const bytes=Buffer.from('{"spacing":   "must stay"}\n');
  let requests=0;
  globalThis.fetch=async(url,options)=>{requests++;assert.equal(url,'https://backend.test.invalid/api/webhooks/stripe?test=1');assert.deepEqual(options.body,bytes);assert.equal(options.headers['stripe-signature'],'signature');assert.equal(options.redirect,'error');return new Response('upstream error',{status:409,headers:{'x-request-id':'request-test'}});};
  const req=Readable.from([bytes.subarray(0,5),bytes.subarray(5)]);Object.assign(req,{url:'/api/webhooks/stripe?test=1',method:'POST',headers:{'content-type':'application/json','stripe-signature':'signature'}});
  const res=response();await proxy()(req,res);assert.equal(res.statusCode,409);assert.equal(res.headers['x-request-id'],'request-test');assert.equal(requests,1);
  for(const bad of [{url:'/api/../private'},{body:Buffer.alloc(12*1024*1024+1)}]){const denied=response();await proxy()({...req,url:'/api/test',...bad},denied);assert([400,413].includes(denied.statusCode));}
  assert.equal(requests,1);
  process.env.BEAUTYBOOK_BACKEND_URL='http://insecure.test.invalid';const denied=response();await proxy()(req,denied);assert.equal(denied.statusCode,503);
 }finally{globalThis.fetch=oldFetch;if(oldBase===undefined)delete process.env.BEAUTYBOOK_BACKEND_URL;else process.env.BEAUTYBOOK_BACKEND_URL=oldBase;}
});

test('netlify functions support v2 Request/Response and normalize function rewrite paths',async()=>{
 const oldFetch=globalThis.fetch,oldBase=process.env.BEAUTYBOOK_BACKEND_URL;
 try{
  process.env.BEAUTYBOOK_BACKEND_URL='https://backend.test.invalid';
  let forwardedUrl='',forwardedBody='',forwardedKey='';
  globalThis.fetch=async(url,options)=>{
   forwardedUrl=url;
   forwardedBody=Buffer.isBuffer(options.body)?options.body.toString('utf8'):String(options.body||'');
   forwardedKey=options.headers['idempotency-key'];
   return new Response(JSON.stringify({id:'job-1',status:'queued'}),{status:202,headers:{'content-type':'application/json'}});
  };
  const webReq=new Request('https://beautybook.netlify.app/.netlify/functions/api/ai/try-on?source=mobile',{
   method:'POST',
   headers:{'content-type':'application/json','idempotency-key':'req-key-1234567890'},
   body:JSON.stringify({mode:'hair',user_photo:'data:image/png;base64,aGVsbG8='}),
  });
  const webRes=await netlifyApi(webReq);
  assert.equal(webRes instanceof Response,true);
  assert.equal(webRes.status,202);
  assert.equal(forwardedUrl,'https://backend.test.invalid/api/ai/try-on?source=mobile');
  assert.equal(forwardedKey,'req-key-1234567890');
  assert.equal(JSON.parse(forwardedBody).mode,'hair');
  assert.deepEqual(await webRes.json(),{id:'job-1',status:'queued'});

  const v1Res=await toNetlify(nested())({
   httpMethod:'GET',
   path:'/.netlify/functions/api/image-jobs/job-1',
   headers:{},
  });
  assert.equal(v1Res.statusCode,202);
  assert.equal(forwardedUrl,'https://backend.test.invalid/api/image-jobs/job-1');

  const statsRes=await engagementStats(new Request('https://beautybook.netlify.app/api/content/styles/engagement-stats',{method:'GET'}));
  assert.equal(statsRes instanceof Response,true);
  assert.equal(statsRes.status,405);

  const shopRes=await shopifyProducts(new Request('https://beautybook.netlify.app/api/shopify-products',{method:'GET'}));
  assert.equal(shopRes instanceof Response,true);
  assert.equal(shopRes.status,503);
 }finally{globalThis.fetch=oldFetch;if(oldBase===undefined)delete process.env.BEAUTYBOOK_BACKEND_URL;else process.env.BEAUTYBOOK_BACKEND_URL=oldBase;}
});

test('netlify api works standalone without BEAUTYBOOK_BACKEND_URL for AI image jobs',async()=>{
 const oldFetch=globalThis.fetch,oldBase=process.env.BEAUTYBOOK_BACKEND_URL,oldUrl=process.env.SUPABASE_URL,oldService=process.env.SUPABASE_SERVICE_ROLE_KEY,oldFal=process.env.FAL_KEY;
 const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137]);
 const jobs=new Map();
 try{
  delete process.env.BEAUTYBOOK_BACKEND_URL;
  process.env.SUPABASE_URL='https://supabase.test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY='service-key-test';
  process.env.FAL_KEY='fal-key-test';

  globalThis.fetch=async(url,options={})=>{
   if(url==='https://supabase.test.invalid/auth/v1/user'){
    return Response.json({id:'11111111-1111-1111-1111-111111111111',email:'user@test.invalid'});
   }
   if(url==='https://queue.fal.run/meta/muse-image/edit'){
    return Response.json({
     request_id:'fal-req-1',
     status_url:'https://queue.fal.run/meta/muse-image/requests/fal-req-1/status',
     response_url:'https://queue.fal.run/meta/muse-image/requests/fal-req-1',
    });
   }
   if(url==='https://queue.fal.run/meta/muse-image/requests/fal-req-1/status'){
    return Response.json({status:'COMPLETED'});
   }
   if(url==='https://queue.fal.run/meta/muse-image/requests/fal-req-1'){
    return Response.json({images:[{url:'https://fal.media.test.invalid/result.png'}]});
   }
   if(url==='https://fal.media.test.invalid/result.png'){
    return new Response(png,{status:200,headers:{'content-type':'image/png'}});
   }
   if(url.startsWith('https://supabase.test.invalid/rest/v1/bb_image_jobs')){
    const method=(options.method||'GET').toUpperCase();
    if(method==='GET'){
     if(url.includes('request_key=eq.'))return Response.json([]);
     const row=jobs.get('22222222-2222-2222-2222-222222222222');
     return Response.json(row?[row]:[]);
    }
    if(method==='POST'){
     const payload=JSON.parse(options.body);
     const row={id:'22222222-2222-2222-2222-222222222222',created_at:'2026-11-28T03:00:00Z',error_code:null,...payload};
     jobs.set(row.id,row);
     return Response.json([row],{status:201});
    }
    if(method==='PATCH'){
     const patch=JSON.parse(options.body);
     const row={...jobs.get('22222222-2222-2222-2222-222222222222'),...patch};
     jobs.set(row.id,row);
     return Response.json([row]);
    }
   }
   if(url.startsWith('https://supabase.test.invalid/storage/v1/object/ai-results/')){
    return Response.json({Key:'ai-results/ok.png'});
   }
   if(url.startsWith('https://supabase.test.invalid/storage/v1/object/sign/ai-results/')){
    return Response.json({signedURL:'/object/sign/ai-results/ok.png?token=abc'});
   }
   throw new Error('Unexpected URL in serverless test: '+url);
  };

  const healthRes=await netlifyApi(new Request('https://beautybook.netlify.app/api/health',{method:'GET'}));
  assert.equal(healthRes.status,200);
  assert.equal((await healthRes.json()).mode,'serverless');

  const createRes=await netlifyApi(new Request('https://beautybook.netlify.app/.netlify/functions/api/ai/try-on',{
   method:'POST',
   headers:{'content-type':'application/json','authorization':'Bearer user-jwt','idempotency-key':'serverless-key-123456'},
   body:JSON.stringify({mode:'hair',category:'coiffure',user_photo:'data:image/png;base64,aGVsbG8=',garment_photo:'https://cdn.test.invalid/style.png',garment_name:'Edgar Cut'}),
  }));
  assert.equal(createRes.status,202);
  const created=await createRes.json();
  assert.equal(created.status,'processing');
  assert.equal(created.id,'22222222-2222-2222-2222-222222222222');

  const pollRes=await netlifyApi(new Request('https://beautybook.netlify.app/.netlify/functions/api/image-jobs/22222222-2222-2222-2222-222222222222',{
   method:'GET',
   headers:{'authorization':'Bearer user-jwt'},
  }));
  assert.equal(pollRes.status,200);
  const polled=await pollRes.json();
  assert.equal(polled.status,'completed');
  assert.equal(polled.result_url,'https://supabase.test.invalid/storage/v1/object/sign/ai-results/ok.png?token=abc');
 }finally{
  globalThis.fetch=oldFetch;
  if(oldBase===undefined)delete process.env.BEAUTYBOOK_BACKEND_URL;else process.env.BEAUTYBOOK_BACKEND_URL=oldBase;
  if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
  if(oldService===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldService;
  if(oldFal===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=oldFal;
 }
});
