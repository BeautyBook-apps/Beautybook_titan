import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemporaryImages, prepareStylistImages, UNUSED_IMAGE_TTL } from '../../src/lib/stylistImages.js';
import { imageInput, createImageJobs } from '../src/services/image-jobs.js';

test('temporary imports are local and revoked three minutes after leaving', () => {
  const revoked = [];
  let callback, delay;
  const media = createTemporaryImages({
    urls: { createObjectURL: () => 'blob:local', revokeObjectURL: url => revoked.push(url) },
    schedule: (fn, ms) => { callback = fn; delay = ms; return 1; }, cancel: () => {},
  });
  assert.equal(media.add({ type: 'image/jpeg', size: 100 }), 'blob:local');
  assert.deepEqual(revoked, []);
  media.leave();
  assert.equal(delay, 180000);
  assert.equal(delay, UNUSED_IMAGE_TTL);
  assert.deepEqual(revoked, []);
  callback();
  assert.deepEqual(revoked, ['blob:local']);
  media.clear();
  assert.equal(revoked.length, 1);
  assert.throws(() => media.add({ type: 'image/svg+xml', size: 10 }));
});

test('article, full outfit and exchange send inline inputs with intact slot mappings', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(new Blob(['image'], { type: 'image/png' })));
  const originalReader = globalThis.FileReader;
  globalThis.FileReader = class {
    readAsDataURL() { this.result = 'data:image/png;base64,aW1hZ2U='; this.onload(); }
  };
  try {
    for (const mode of ['article', 'outfit', 'exchange']) {
      const prepared = await prepareStylistImages({ photo: 'blob:person', references: ['blob:reference'], pieces: mode === 'outfit' ? { top: 'blob:top', bottom: 'blob:bottom', bag: null } : undefined });
      const input = imageInput({ ...prepared, mode, module: 'styliste_ia' });
      assert(input.images.every(image => image.startsWith('data:image/')));
      assert.equal(input.images.length, mode === 'outfit' ? 3 : 2);
      if (mode === 'outfit') assert.deepEqual(input.items, ['top', 'bottom']);
    }
  } finally {
    if (originalReader === undefined) delete globalThis.FileReader;
    else globalThis.FileReader = originalReader;
  }
});

test('history is scoped to its owner and validated types, with more results indicated', async () => {
  let parameters;
  const database = { query: async (_sql, params) => {
    parameters = params;
    return { rows: [{ id: 'one', status: 'completed', output_path: 'owner/one.png', kind: 'outfit' }, { id: 'two' }] };
  } };
  const service = createImageJobs(database, { storage: { url: async path => 'https://private.example/' + path } });
  const result = await service.list({ id: 'owner' }, { limit: 1, kinds: 'article,outfit,exchange' });
  assert.deepEqual(parameters, ['owner', ['article', 'outfit', 'exchange'], 2]);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.has_more, true);
  assert(result.jobs[0].result_url.includes('owner/one.png'));
  await assert.rejects(service.list({ id: 'owner' }, { kinds: 'invalid' }), { code: 'INVALID_IMAGE_MODE' });
  await assert.rejects(service.list({ id: 'owner' }, { limit: 10000 }), { code: 'INVALID_HISTORY_LIMIT' });
});
