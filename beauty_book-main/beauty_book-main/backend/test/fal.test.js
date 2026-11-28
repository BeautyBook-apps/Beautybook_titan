import test from 'node:test';
import assert from 'node:assert/strict';
import { submitFalModel, falMuseImageEdit } from '../src/services/fal.js';

test('retrieves a submitted edit through the canonical queue URLs without resubmitting', async () => {
  const oldKey = process.env.FAL_KEY;
  process.env.FAL_KEY = 'test-only';
  try {
    for (const includeUrls of [true, false]) {
      const calls = [];
      const root = 'https://queue.fal.run/meta/muse-image/requests/example';
      const output = { images: [{ url: 'https://example.com/result.png' }] };
      const result = await submitFalModel('meta/muse-image/edit', {}, {
        fetchImpl: async (url, options) => {
          calls.push([url, options.method || 'GET']);
          if (calls.length === 1) return Response.json({ request_id: 'example', ...(includeUrls ? { status_url: root + '/status', response_url: root } : {}) });
          if (url === root + '/status') return Response.json({ status: 'COMPLETED' });
          if (url === root) return Response.json(output);
          throw new Error('Incorrect queue URL: ' + url);
        },
      });
      assert.deepEqual(result, output);
      assert.equal(calls.filter(([, method]) => method === 'POST').length, 1);
      assert.equal(calls.length, 3);
    }
  } finally {
    if (oldKey === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = oldKey;
  }
});

test('unavailable reference prevents any paid submission', async () => {
  let submissions = 0;
  await assert.rejects(falMuseImageEdit({
    images: ['https://example.com/missing.png'], prompt: 'preview',
    fetchImpl: async (_url, options) => {
      if (options.method === 'POST') submissions++;
      return new Response(null, { status: 404 });
    },
  }), { code: 'FAL_IMAGE_UNAVAILABLE' });
  assert.equal(submissions, 0);
});
