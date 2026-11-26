import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthFlows, readSignupDraft, saveSignupDraft, strongPassword } from '../../src/lib/authFlows.js';
const user = { id: 'fixture-user', email: 'fixture@example.invalid', user_metadata: { full_name: 'Fixture' } };
const storage = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; };
function clientFixture({ profile = { id: user.id, role: 'vendeur' }, profileError = null, session = { user } } = {}) {
  const writes = [], authCalls = [];
  return { writes, authCalls,
    auth: {
      verifyOtp: async params => { authCalls.push(params); return { data: { session }, error: null }; },
      signUp: async params => { authCalls.push(params); return { data: { user, session }, error: null }; },
      resend: async params => { authCalls.push(params); return { error: null }; },
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: profileError }), single: async () => ({ data: profile, error: profileError }) }) }),
      insert: record => { writes.push(record); return { select: () => ({ single: async () => ({ data: record, error: profileError }) }) }; },
    }) };
}

test('signup drafts reject secrets and clean drafts from older versions', () => {
  const store = storage();
  store.setItem('bb_signup_data', JSON.stringify({ email: user.email, password: 'old-secret', access_token: 'token' }));
  assert.deepEqual(readSignupDraft(store), { email: user.email });
  assert.equal(store.getItem('bb_signup_data').includes('secret'), false);
  saveSignupDraft(store, { prenom: 'Fixture', password: 'must-never-persist', interests: ['SOINS'] });
  assert.deepEqual(readSignupDraft(store), { prenom: 'Fixture', interests: ['SOINS'] });
  store.setItem('bb_signup_data', '{invalid');
  assert.deepEqual(readSignupDraft(store), {});
});
test('password validation always requires eight characters', () => {
  assert.equal(strongPassword('Aa1!'), false);
  assert.equal(strongPassword('abcdefgh'), false);
  assert.equal(strongPassword('Abcdef12'), true);
});
test('OTP session is used directly without storing or resubmitting a password', async () => {
  const client = clientFixture();
  const session = await createAuthFlows(client).verifySignup({ mode: 'email', email: user.email }, '123456');
  assert.equal(session.user.id, user.id);
  assert.deepEqual(client.authCalls, [{ email: user.email, type: 'email', token: '123456' }]);
  assert.deepEqual(client.writes, [], 'existing professional role must not be overwritten on login');
});
test('verification cannot advance without a session or a readable saved profile', async () => {
  await assert.rejects(createAuthFlows(clientFixture({ session: null })).verifySignup({ email: user.email }, '123456'), /session/);
  await assert.rejects(createAuthFlows(clientFixture({ profileError: { message: 'network failure' } })).verifySignup({ email: user.email }, '123456'), /profil/);
});
test('a new profile leaves the role to the database default', async () => {
  const client = clientFixture({ profile: null });
  const profile = await createAuthFlows(client).ensureProfile(user);
  assert.equal(profile.role, undefined); assert.equal(profile.id, user.id); assert.equal(client.writes.length, 1);
  assert.equal('role' in client.writes[0], false);
});
test('signup stores only a safe draft and resend reports provider failure', async () => {
  const client = clientFixture({ session: null }), store = storage();
  const result = await createAuthFlows(client).signup({ prenom: ' A ', nom: ' B ', email: ' fixture@example.invalid ', password: 'Abcdef12' }, store, 'https://beautybook.test.invalid/auth/callback');
  assert.equal(result.verified, false); assert.equal(readSignupDraft(store).email, user.email);
  assert.equal(store.getItem('bb_signup_data').includes('Abcdef12'), false);
  client.auth.resend = async () => ({ error: { message: 'rate limit' } });
  await assert.rejects(createAuthFlows(client).resendSignup({ email: user.email }), /envoyé/);
});
