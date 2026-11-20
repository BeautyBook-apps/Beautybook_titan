import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {databaseFixture,users} from './database-fixture.js';
import {createImageJobs,imageInput} from '../src/services/image-jobs.js';
import {createImageSearch} from '../src/services/image-search.js';
import {HttpError} from '../src/lib/errors.js';
const input={mode:'article',user_photo:'https://images.test.invalid/person.png',garment_photo:'https://images.test.invalid/shirt.png',garment_name:'Chemise'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=','base64');
test('image inputs reject invalid schemes, modes and oversized payloads',()=>{
 assert.equal(imageInput(input).images.length,2);
 assert.deepEqual(imageInput({...input,reference_images:['https://images.test.invalid/front.png','https://images.test.invalid/back.png']}).images.slice(1),['https://images.test.invalid/front.png','https://images.test.invalid/back.png']);
 for(const bad of [{mode:'arbitrary'},{user_photo:'file:///private.txt'},{user_photo:'https://user:secret@host.invalid/photo'},{garment_photo:null},{user_photo:'data:image/svg+xml;base64,PHN2Zz4='}])assert.throws(()=>imageInput({...input,...bad}));
 assert.equal(imageInput({...input,mode:'outfit',outfit_pieces:{top:input.garment_photo,bottom:input.garment_photo}}).images.length,3);
});
test('image jobs isolate owners, cap requests and never fabricate or automatically repeat a failed generation',async t=>{
 const db=await databaseFixture(),files=new Map();let generated=0,mode='success';
 const storage={save:async(path,bytes)=>{files.set(path,bytes);if(mode==='storage-timeout')throw new Error('Disconnected after upload');},url:async p=>'https://signed.test.invalid/'+p,exists:async p=>files.has(p),remove:async p=>{files.delete(p);}};
 const service=createImageJobs(db,{configured:()=>true,storage,dailyLimit:()=>10,generate:async()=>{generated++;if(mode==='network')throw new HttpError(502,'AI_NETWORK_ERROR','Timeout');if(mode==='bad-result')return {data:[]};return {data:[{b64_json:png.toString('base64')}]};}});
 try{
  let first;
  await t.test('idempotency does not queue a second provider call; active quota is enforced',async()=>{
   const key=randomUUID();first=await service.create(users.client,input,key);
   assert.equal(first.status,'queued');assert.equal((await service.create(users.client,input,key)).id,first.id);
   await assert.rejects(service.create(users.client,{...input,garment_name:'Autre'},key),{code:'IDEMPOTENCY_CONFLICT'});
   const second=await service.create(users.client,input,randomUUID());
   await assert.rejects(service.create(users.client,input,randomUUID()),{code:'AI_QUOTA_REACHED'});
   await service.remove(users.client,second.id);assert.equal(generated,0);
  });
  await t.test('only persisted provider bytes produce a private result; another user cannot read or delete it',async()=>{
   await assert.rejects(service.get(users.other,first.id),{code:'IMAGE_NOT_FOUND'});
   assert.equal(await service.runOne(),true);assert.equal(generated,1);
   const result=await service.get(users.client,first.id);assert.equal(result.status,'completed');assert(result.result_url.startsWith('https://signed.'));
   assert.equal((await service.list(users.other)).jobs.length,0);
   await assert.rejects(service.remove(users.other,first.id),{code:'IMAGE_NOT_FOUND'});
   assert.equal((await db.query('SELECT input FROM bb_image_jobs WHERE id=$1',[first.id])).rows[0].input.images,undefined);
   await db.as(users.client);await assert.rejects(db.query('SELECT * FROM bb_image_jobs'),{code:'42501'});await db.privileged();
   await service.remove(users.client,first.id);assert.equal(files.size,0);
  });
  await t.test('ambiguous network failure is visible and is never retried automatically',async()=>{
   mode='network';const job=await service.create(users.client,input,randomUUID());await service.runOne();
   const result=await service.get(users.client,job.id);assert.equal(result.status,'uncertain');assert.equal(result.result_url,undefined);
   const count=generated;assert.equal(await service.runOne(),false);assert.equal(generated,count);
  });
  await t.test('empty provider result is a failure, not the original image presented as a result',async()=>{
   mode='bad-result';const job=await service.create(users.client,input,randomUUID());await service.runOne();
   assert.equal((await service.get(users.client,job.id)).status,'failed');assert.equal((await service.get(users.client,job.id)).result_url,undefined);
  });
  await t.test('worker recovers a saved output after a storage timeout without charging for another generation',async()=>{
   mode='storage-timeout';const job=await service.create(users.client,input,randomUUID());await service.runOne();
   assert.equal((await service.get(users.client,job.id)).status,'processing');
   await assert.rejects(service.remove(users.client,job.id),{code:'IMAGE_PROCESSING'});
   await db.query("UPDATE bb_image_jobs SET started_at=now()-interval '11 minutes' WHERE id=$1",[job.id]);
   const count=generated;await service.runOne();assert.equal(generated,count);assert.equal((await service.get(users.client,job.id)).status,'completed');
  });
 }finally{await db.close();}
});
test('visual search returns only matching registered products, never model-invented purchase links',async()=>{
 let params;
 const database={query:async(sql,p)=>{params=p;return {rows:[{id:'registered',name:'Chemise',images:['https://image.test.invalid/product.png'],price:20}]};}};
 const response=data=>async()=>({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]});
 const search=createImageSearch(database,response({detected_items:[{type:'chemise',color:'blanc'}],products:[{id:'invented'}]}));
 const result=await search({image_url:input.user_photo});assert.equal(result.products[0].id,'registered');assert.deepEqual(params,['actif','active',['%chemise%']]);
 await assert.rejects(createImageSearch(database,response({detected_items:'invalid'}))({image_url:input.user_photo}),{code:'INVALID_AI_RESULT'});
});
