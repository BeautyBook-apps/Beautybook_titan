// Stop on permanent errors, especially 401: polling must not repeatedly refresh
// an invalid session. A manual retry or a new sign-in starts a fresh subscription.
export function watchImageJobHistory(request, query, { onData, onError, onSettled, schedule = setTimeout, cancel = clearTimeout }) {
  const controller = new AbortController();
  let timer;
  let failures = 0;
  async function refresh() {
    let delay = 5000;
    try {
      const result = await request('/api/image-jobs?' + query, { method: 'GET', requireAuth: true, signal: controller.signal });
      if (controller.signal.aborted) return;
      failures = 0;
      onData(result);
    } catch (error) {
      if (controller.signal.aborted) return;
      onError(error);
      const transient = error.status === 0 || error.status === 429 || error.status >= 500;
      delay = transient && ++failures < 3 ? 5000 * 2 ** failures : null;
    } finally {
      if (!controller.signal.aborted) {
        onSettled();
        if (delay !== null) timer = schedule(refresh, delay);
      }
    }
  }
  void refresh();
  return () => { controller.abort(); cancel(timer); };
}
