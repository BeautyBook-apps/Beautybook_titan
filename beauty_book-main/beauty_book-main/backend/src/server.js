import { createApp } from './app.js';
import { missingConfiguration } from './config/env.js';
import { imageJobs } from './services/image-jobs.js';
import { checkAuthConnectivity } from './services/auth-health.js';
const missing = missingConfiguration();
if (process.env.NODE_ENV === 'production' && missing.length) throw new Error('Backend configuration missing: ' + missing.join(', '));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const server = createApp().listen(port, host, async () => {
  console.log(`BeautyBook API listening on http://${host}:${port}; configured=${missing.length === 0}`);
  const authentication = await checkAuthConnectivity();
  console[authentication.reachable ? 'info' : 'error'](JSON.stringify({ event: 'auth_connectivity', ...authentication }));
});
// Recover jobs queued before a restart even if the standalone worker process
// is not running. Database locks keep this safe alongside an external worker.
if(process.env.DATABASE_URL)imageJobs.start();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  imageJobs.stop();
  server.close(() => process.exit(0));
});
