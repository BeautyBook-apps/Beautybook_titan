import { backendProxy } from '../../api/_lib/backend-proxy.js';
import { toNetlify } from './_adapter.js';

export default toNetlify(backendProxy());
