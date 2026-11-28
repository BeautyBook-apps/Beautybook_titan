import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl, requestApi } from '../../src/lib/apiTransport.js';
test('API base paths normalize without duplicate api prefixes',()=>{
  assert.equal(apiUrl('/reservations','https://api.example.test/api'),'https://api.example.test/api/reservations');
  assert.equal(apiUrl('/api/ai/maria','https://api.example.test'),'https://api.example.test/api/ai/maria');
  assert.throws(()=>apiUrl('//attacker.invalid'));
});
test('failed operation cannot become a successful-looking result',async()=>{
  for(const body of [{success:false},{fallback:true},{error:'Denied'}]) await assert.rejects(requestApi('/test',{}, {fetchImpl:async()=>Response.json(body)}));
});
test('request attaches the current session and preserves request ID errors',async()=>{
  await assert.rejects(requestApi('/test',{}, {getSession:async()=>({access_token:'test-session'}),fetchImpl:async(_,options)=>{
    assert.equal(options.headers.get('Authorization'),'Bearer test-session');
    return Response.json({error:'Expired',code:'SESSION_INVALID',request_id:'req-1'},{status:401});
  }}),error=>error.status===401 && error.requestId==='req-1');
});

test('private history does not send an anonymous request',async()=>{
  await assert.rejects(requestApi('/image-jobs',{requireAuth:true},{
    getSession:async()=>null,fetchImpl:async()=>assert.fail('No anonymous request'),
  }),error=>error.status===401&&error.code==='AUTH_REQUIRED');
});

test('a refreshed token restores the authenticated request',async()=>{
  let calls=0;
  const result=await requestApi('/image-jobs',{requireAuth:true},{
    getSession:async()=>({access_token:'old',refresh_token:'refresh'}),
    refreshSession:async()=>({access_token:'new'}),
    fetchImpl:async(_,options)=>{
      assert.equal(options.headers.get('Authorization'),++calls===1?'Bearer old':'Bearer new');
      return calls===1?Response.json({}, {status:401}):Response.json({jobs:[]});
    },
  });
  assert.deepEqual(result,{jobs:[]});
  assert.equal(calls,2);
});

test('a network failure after refreshing is not reported as an expired session',async()=>{
  let calls=0;
  await assert.rejects(requestApi('/image-jobs',{}, {
    getSession:async()=>({access_token:'old',refresh_token:'refresh'}),
    refreshSession:async()=>({access_token:'new'}),
    fetchImpl:async()=>{if(++calls===1)return Response.json({}, {status:401});throw new TypeError('fetch failed');},
  }),error=>error.status===0&&error.code==='NETWORK_ERROR');
});
