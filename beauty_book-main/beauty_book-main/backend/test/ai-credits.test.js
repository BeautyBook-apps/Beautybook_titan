import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {databaseFixture,users} from './database-fixture.js';
import {createAICreditsService} from '../src/services/ai-credits.js';

test('AI credits prefer the five daily free generations, then debit paid credits atomically',async()=>{
 const db=await databaseFixture();
 try{
  const service=createAICreditsService(db,{getAppUrl:()=> 'https://beautybook.example.invalid',getStripe:()=>({checkout:{sessions:{create:async()=>({id:'cs_ai_fixture',url:'https://checkout.stripe.com/c/pay/ai-fixture'})}}})});
  assert.deepEqual((await service.summary(users.client.id)).free_remaining,5);
  for(let i=0;i<5;i++)await db.transaction(async client=>{
   const reservation=await service.reserve(client,users.client.id,5);
   assert.equal(reservation.source,'free');
   await client.query('INSERT INTO bb_image_jobs(user_id,request_key,request_hash,kind,label,input,billing_source,credit_cost) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)',[users.client.id,randomUUID(),randomUUID(),'hair','Fixture','{}','free',0]);
  });
  assert.equal((await service.summary(users.client.id)).free_remaining,0);
  await assert.rejects(db.transaction(client=>service.reserve(client,users.client.id,5)),{code:'AI_QUOTA_REACHED'});

  const checkout=await service.checkout(users.client,'studio',randomUUID());
  const event={id:'evt_ai_fixture',type:'checkout.session.completed',data:{object:{id:checkout.session_id,payment_status:'paid',currency:'eur',amount_total:999,client_reference_id:users.client.id,payment_intent:'pi_ai_fixture',metadata:{type:'ai_credits',package_id:'studio'}}}};
  await service.handleEvent(event);
  await service.handleEvent(event);
  assert.equal((await service.summary(users.client.id)).credits,30);
  await db.transaction(async client=>{
   const reservation=await service.reserve(client,users.client.id,5);
   assert.equal(reservation.source,'credits');
   const {rows:[job]}=await client.query('INSERT INTO bb_image_jobs(user_id,request_key,request_hash,kind,label,input,billing_source,credit_cost) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING id',[users.client.id,randomUUID(),randomUUID(),'hair','Fixture','{}','credits',1]);
   await service.recordGeneration(client,users.client.id,job.id,reservation);
  });
  assert.equal((await service.summary(users.client.id)).credits,29);
 }finally{await db.close();}
});
