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
