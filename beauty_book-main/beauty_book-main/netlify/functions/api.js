import { backendProxy } from '../../api/_lib/backend-proxy.js';
import { toNetlify } from './_adapter.js';
import { serverlessApiHandler } from './_serverless-api.js';

const proxy = backendProxy();

export default toNetlify(async (req, res) => {
  if (process.env.BEAUTYBOOK_BACKEND_URL) {
    return proxy(req, res);
  }
  return serverlessApiHandler(req, res);
});
