import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {databaseFixture,users} from './database-fixture.js';
import {createAICreditsService} from '../src/services/ai-credits.js';

test('AI generations are unlimited and never debit a paid-credit wallet',async()=>{
 const db=await databaseFixture();
 try{
  const service=createAICreditsService(db,{getAppUrl:()=> 'https://beautybook.example.invalid',getStripe:()=>({checkout:{sessions:{create:async()=>({id:'cs_ai_fixture',url:'https://checkout.stripe.com/c/pay/ai-fixture'})}}})});
  const initial=await service.summary(users.client.id);
  assert.equal(initial.unlimited,true);
  assert.equal(initial.free_limit,null);
  assert.equal(initial.free_remaining,null);
  for(let i=0;i<8;i++)await db.transaction(async client=>{
   const reservation=await service.reserve(client,users.client.id);
   assert.equal(reservation.source,'free');
   await client.query('INSERT INTO bb_image_jobs(user_id,request_key,request_hash,kind,label,input,billing_source,credit_cost) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)',[users.client.id,randomUUID(),randomUUID(),'hair','Fixture','{}','free',0]);
  });
  const afterFree=await service.summary(users.client.id);
  assert.equal(afterFree.free_used,8);
  assert.equal(afterFree.free_remaining,null);

  const checkout=await service.checkout(users.client,'studio',randomUUID());
  const event={id:'evt_ai_fixture',type:'checkout.session.completed',data:{object:{id:checkout.session_id,payment_status:'paid',currency:'eur',amount_total:999,client_reference_id:users.client.id,payment_intent:'pi_ai_fixture',metadata:{type:'ai_credits',package_id:'studio'}}}};
  await service.handleEvent(event);
  await service.handleEvent(event);
  assert.equal((await service.summary(users.client.id)).credits,30);
  await db.transaction(async client=>{
   const reservation=await service.reserve(client,users.client.id);
   assert.equal(reservation.source,'free');
   const {rows:[job]}=await client.query('INSERT INTO bb_image_jobs(user_id,request_key,request_hash,kind,label,input,billing_source,credit_cost) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING id',[users.client.id,randomUUID(),randomUUID(),'hair','Fixture','{}','credits',1]);
   await service.recordGeneration(client,users.client.id,job.id,reservation);
  });
  assert.equal((await service.summary(users.client.id)).credits,30);
 }finally{await db.close();}
});
