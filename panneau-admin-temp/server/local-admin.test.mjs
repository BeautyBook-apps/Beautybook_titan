import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptsLocalRequest, createLocalDataApi, localAdminPlugin } from './local-admin.mjs';

test('local access requires a loopback socket, expected host and capability', () => {
  const token = 'a'.repeat(64), origin = 'http://localhost:5174';
  const req = { socket: { remoteAddress: '::1' }, headers: { host: 'localhost:5174', origin, 'x-beautybook-local-admin': token } };
  assert.equal(acceptsLocalRequest(req, token, origin), true);
  for (const headers of [
    { ...req.headers, origin: 'https://untrusted.example' },
    { ...req.headers, host: 'untrusted.example:5174' },
    { ...req.headers, 'x-beautybook-local-admin': '' },
    { ...req.headers, 'sec-fetch-site': 'cross-site' },
  ]) assert.equal(acceptsLocalRequest({ ...req, headers }, token, origin), false);
  assert.equal(acceptsLocalRequest({ ...req, socket: { remoteAddress: '192.168.1.20' } }, token, origin), false);
});

test('passwordless bridge cannot run on a public interface or in production', () => {
  const plugin = localAdminPlugin({});
  assert.equal(plugin.apply, 'serve');
  for (const [mode, host] of [['production', 'localhost'], ['development', '0.0.0.0']]) {
    assert.throws(() => plugin.configureServer({ config: { mode, server: { host } } }), /localhost/);
  }
});

test('local bridge preserves protected fields and dedicated business operations', async () => {
  const client = { from: () => ({}) }, api = createLocalDataApi(client);
  await assert.rejects(api.entities({ table: 'Reservation', operation: 'update', id: 'id', data: { payment_status: 'paye' } }), e => e.status === 403);
  await assert.rejects(api.entities({ table: 'profiles', operation: 'update', id: 'id', data: { role: 'admin' } }), e => e.status === 400);
  await assert.rejects(api.entities({ table: 'profiles', operation: 'delete', id: 'id' }), e => e.status === 409);
});

test('missing rows and remote errors cannot produce a successful local update', async () => {
  for (const result of [{ data: null, error: null }, { status: 403, data: null, error: { message: 'Refusé' } }]) {
    const query = { update() { return this; }, eq() { return this; }, select() { return this; }, async maybeSingle() { return result; } };
    await assert.rejects(createLocalDataApi({ from: () => query }).entities({ table: 'Style', operation: 'update', id: 'id', data: { status: 'publie' } }), e => e.status === (result.error ? 403 : 404));
  }
});

test('empty unavailable optional fields are omitted, meaningful values are not lost', async () => {
  let payload;
  const query = { insert(data) { payload = data; return this; }, select() { return this; }, async maybeSingle() { return { data: { id: 'remote-id', ...payload } }; } };
  const api = createLocalDataApi({ from: () => query }, { columns: async () => new Set(['title']) });
  const row = await api.entities({ table: 'ImmobilierListing', operation: 'create', data: { title: 'Salon', contact_email: '', latitude: null } });
  assert.deepEqual(payload, { title: 'Salon' });
  assert.equal(row.id, 'remote-id');
  await assert.rejects(api.entities({ table: 'ImmobilierListing', operation: 'create', data: { title: 'Salon', contact_email: 'contact@example.com' } }), e => e.status === 409);
});
