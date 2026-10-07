import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminEntity } from './adminEntity.mjs';

test('admin content uses the server ID for subsequent updates', async () => {
  const calls = [];
  const entity = createAdminEntity('Style', {
    async post(path, body) {
      calls.push({ path, body });
      return { result: { id: 'server-id', ...body.data } };
    },
  });
  const created = await entity.create({ title: 'Style test' });
  const updated = await entity.update(created.id, { status: 'publie' });
  assert.equal(updated.status, 'publie');
  assert.deepEqual(calls[1], {
    path: '/admin/entities',
    body: { table: 'Style', operation: 'update', id: 'server-id', data: { status: 'publie' } },
  });
});

test('rejected writes are propagated once without local success or retry', async () => {
  for (const method of ['create', 'update', 'delete']) {
    let calls = 0;
    const error = Object.assign(new Error('Écriture refusée'), { status: 403 });
    const entity = createAdminEntity('ImmobilierListing', {
      async post() { calls++; throw error; },
    });
    await assert.rejects(() => method === 'create' ? entity[method]({ title: 'Test' }) : entity[method]('missing-id', { status: 'loue' }), e => e === error);
    assert.equal(calls, 1);
  }
});

test('failed list requests do not become an empty successful listing', async () => {
  const entity = createAdminEntity('Style', { post: async () => { throw new Error('Backend indisponible'); } });
  await assert.rejects(entity.list(), /Backend indisponible/);
});
