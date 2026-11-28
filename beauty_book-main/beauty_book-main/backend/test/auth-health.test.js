import test from 'node:test';
import assert from 'node:assert/strict';
import {checkAuthConnectivity} from '../src/services/auth-health.js';
const env={SUPABASE_URL:'https://project.example.test/',SUPABASE_ANON_KEY:'test-public-key'};

test('auth readiness checks connectivity without a user session',async()=>{
  const result=await checkAuthConnectivity({env,fetchImpl:async(url,options)=>{
    assert.equal(url,'https://project.example.test/auth/v1/settings');
    assert.equal(options.headers.apikey,env.SUPABASE_ANON_KEY);
    assert.equal(options.headers.Authorization,undefined);
    return Response.json({external:{}});
  }});
  assert.deepEqual(result,{reachable:true});
});
test('configured but network-isolated process is not ready',async()=>{
  const result=await checkAuthConnectivity({env,fetchImpl:async()=>{
    throw new TypeError('secret must not appear',{cause:{code:'ENOTFOUND'}});
  }});
  assert.deepEqual(result,{reachable:false,code:'AUTH_UNAVAILABLE',reason:'ENOTFOUND'});
});
test('auth readiness distinguishes invalid configuration from upstream outages',async()=>{
  for(const status of [401,403,429,503]){
    const result=await checkAuthConnectivity({env,fetchImpl:async()=>Response.json({}, {status})});
    assert.equal(result.reachable,false);
    assert.equal(result.code,status===401||status===403?'AUTH_CONFIGURATION_INVALID':'AUTH_UNAVAILABLE');
  }
  assert.equal((await checkAuthConnectivity({env:{},fetchImpl:async()=>assert.fail()})).code,'BACKEND_NOT_CONFIGURED');
  assert.equal((await checkAuthConnectivity({env,fetchImpl:async()=>Response.json({})})).code,'AUTH_INVALID_RESPONSE');
});
