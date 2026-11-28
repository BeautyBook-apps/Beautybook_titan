import test from 'node:test';
import assert from 'node:assert/strict';
import {requestImageJob} from '../../src/lib/imageJobsClient.js';
import {ApiError} from '../../src/lib/apiTransport.js';

test('temporary 500 during polling recovers the existing result without another POST', async()=>{
 const calls=[];let reads=0;
 const result=await requestImageJob(async(path,options)=>{
  calls.push({path,method:options.method});
  if(options.method==='POST')return {id:'saved-job',status:'processing'};
  if(++reads===1)throw new ApiError('Unavailable',500,'INTERNAL_ERROR');
  return {id:'saved-job',status:'completed',result_url:'https://example.com/saved.png'};
 },{},{wait:async()=>{}});
 assert.equal(result.result_url,'https://example.com/saved.png');
 assert.equal(calls.filter(call=>call.method==='POST').length,1);
 assert.deepEqual(calls.filter(call=>call.method==='GET').map(call=>call.path),['/api/image-jobs/saved-job','/api/image-jobs/saved-job']);
});

test('persistent read outage remains pending and does not claim generation failure',async()=>{
 let reads=0;
 await assert.rejects(requestImageJob(async(_path,options)=>{
  if(options.method==='POST')return {id:'saved-job',status:'processing'};
  reads++;throw new ApiError('Unavailable',503);
 },{},{wait:async()=>{},maxReadRetries:3}),{code:'IMAGE_PENDING',jobId:'saved-job'});
 assert.equal(reads,3);
});

test('authorization errors during polling are not retried',async()=>{
 let reads=0;
 await assert.rejects(requestImageJob(async(_path,options)=>{
  if(options.method==='POST')return {id:'saved-job',status:'processing'};
  reads++;throw new ApiError('Forbidden',403,'FORBIDDEN');
 },{},{wait:async()=>{}}),{code:'FORBIDDEN'});
 assert.equal(reads,1);
});
test('image client polls actual job states and submits the request only once',async()=>{
 const calls=[],states=['queued','processing','completed'];
 const result=await requestImageJob(async(path,options)=>{calls.push({path,options});const status=states.shift();return {id:'test-job',status,...(status==='completed'?{result_url:'https://test.invalid/output.png'}:{})};},{mode:'article'},{idempotencyKey:'one-logical-request',wait:async()=>{}});
 assert.equal(result.status,'completed');assert.equal(calls.filter(c=>c.options.method==='POST').length,1);
 assert.equal(calls[0].options.headers['Idempotency-Key'],'one-logical-request');assert.equal(calls[2].path,'/api/image-jobs/test-job');
});
test('closing tracking aborts polling without claiming to cancel an already submitted provider request',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(requestImageJob(async()=>{calls++;return {id:'job',status:'processing'};},{},{signal:controller.signal,wait:async()=>controller.abort()}),{name:'AbortError'});
 assert.equal(calls,1);
});
test('failed or missing image results cannot become successful output',async()=>{
 for(const status of ['failed','uncertain','completed'])await assert.rejects(requestImageJob(async()=>({id:'job',status}),{},{wait:async()=>{}}));
});

test('transient gateway error on create retries with the same idempotency key',async()=>{
 const keys=[];let creates=0;
 const result=await requestImageJob(async(path,options)=>{
  if(options.method==='POST'){
   keys.push(options.headers['Idempotency-Key']);
   if(++creates===1)throw new ApiError('Indisponible',502,'BACKEND_UNAVAILABLE');
   return {id:'retried-job',status:'completed',result_url:'https://example.com/ok.png'};
  }
  return {id:'retried-job',status:'completed',result_url:'https://example.com/ok.png'};
 },{mode:'hair'},{idempotencyKey:'same-key-1234567890',wait:async()=>{}});
 assert.equal(result.result_url,'https://example.com/ok.png');
 assert.deepEqual(keys,['same-key-1234567890','same-key-1234567890']);
});
