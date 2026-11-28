import test from 'node:test';
import assert from 'node:assert/strict';
import { watchImageJobHistory } from '../../src/lib/imageJobHistory.js';
import { requestApi } from '../../src/lib/apiTransport.js';

test('history stops after a rejected session and its single refresh attempt', async () => {
  let requests = 0, refreshes = 0, schedules = 0, settled;
  const done = new Promise(resolve => { settled = resolve; });
  const stop = watchImageJobHistory((path, options) => requestApi(path, options, {
    getSession: async () => ({ access_token: 'expired', refresh_token: 'refresh' }),
    refreshSession: async () => { refreshes++; return { access_token: 'rejected' }; },
    fetchImpl: async () => { requests++; return Response.json({ error: 'Session refusée' }, { status: 401 }); },
  }), 'limit=20', {
    onData: () => assert.fail('Private history must remain inaccessible'),
    onError: error => assert.equal(error.status, 401),
    onSettled: settled,
    schedule: () => { schedules++; },
  });
  await done;
  assert.equal(requests, 2);
  assert.equal(refreshes, 1);
  assert.equal(schedules, 0);
  stop();
});

test('history retries temporary failures with a bounded backoff', async () => {
  let pending, requests = 0;
  const delays = [];
  const stop = watchImageJobHistory(async () => { requests++; throw { status: 503 }; }, '', {
    onData: () => assert.fail(), onError: () => {}, onSettled: () => {},
    schedule: (fn, ms) => { pending = fn; delays.push(ms); },
  });
  await new Promise(resolve => setImmediate(resolve));
  await pending();
  const lastRetry = pending;
  pending = undefined;
  await lastRetry();
  assert.equal(requests, 3);
  assert.deepEqual(delays, [10000, 20000]);
  assert.equal(pending, undefined);
  stop();
});

test('closing history cancels the request and suppresses late private results', async () => {
  let finish, signal;
  const stop = watchImageJobHistory((_, options) => {
    signal = options.signal;
    return new Promise(resolve => { finish = resolve; });
  }, '', {
    onData: () => assert.fail(), onError: () => assert.fail(),
    onSettled: () => assert.fail(), schedule: () => assert.fail(),
  });
  stop();
  finish({ jobs: [] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(signal.aborted, true);
});
