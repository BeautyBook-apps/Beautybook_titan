function normalizeUrl(rawUrl, headers = {}) {
  const fallbackHost = headers['x-forwarded-host'] || headers.host || 'beautybook.invalid';
  const proto = headers['x-forwarded-proto'] || 'https';
  const parsed = new URL(rawUrl || '/', `${proto}://${fallbackHost}`);
  if (parsed.pathname.startsWith('/.netlify/functions/api')) {
    const rest = parsed.pathname.slice('/.netlify/functions/api'.length);
    parsed.pathname = rest ? `/api${rest.startsWith('/') ? rest : `/${rest}`}` : '/api';
  }
  return parsed.pathname + parsed.search;
}

function parseBody(rawBuffer, headers) {
  if (!rawBuffer || rawBuffer.length === 0) return '';
  if (headers['stripe-signature']) return rawBuffer;
  if (/application\/json/i.test(headers['content-type'] || '')) {
    try { return JSON.parse(rawBuffer.toString('utf8')); } catch { /* validated downstream */ }
  }
  return rawBuffer;
}

export function toNetlify(handler) {
  return async (eventOrRequest) => {
    const isWebRequest = typeof eventOrRequest?.headers?.get === 'function'
      && typeof eventOrRequest?.arrayBuffer === 'function';

    let method;
    let headers;
    let body;
    let url;
    let remoteAddress = '';

    if (isWebRequest) {
      method = eventOrRequest.method || 'GET';
      headers = {};
      eventOrRequest.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
      url = normalizeUrl(eventOrRequest.url, headers);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
        const rawBuffer = Buffer.from(await eventOrRequest.arrayBuffer());
        body = parseBody(rawBuffer, headers);
      } else {
        body = '';
      }
      remoteAddress = (headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || '').split(',')[0].trim();
    } else {
      method = eventOrRequest.httpMethod || 'GET';
      headers = Object.fromEntries(
        Object.entries(eventOrRequest.headers || {}).map(([key, value]) => [key.toLowerCase(), value])
      );
      url = normalizeUrl(eventOrRequest.rawUrl || eventOrRequest.path || '/', headers);
      let raw = eventOrRequest.body || '';
      if (eventOrRequest.isBase64Encoded && raw) {
        raw = Buffer.from(raw, 'base64');
      } else if (typeof raw === 'string' && raw.length > 0) {
        raw = Buffer.from(raw, 'utf8');
      }
      body = Buffer.isBuffer(raw) ? parseBody(raw, headers) : raw;
      remoteAddress = eventOrRequest.requestContext?.identity?.sourceIp || '';
    }

    const state = { statusCode: 200, headers: {}, body: null, isBase64Encoded: false };
    const response = {
      setHeader(name, value) { state.headers[name] = String(value); },
      status(code) { state.statusCode = code; return response; },
      json(value) {
        state.headers['Content-Type'] = 'application/json; charset=utf-8';
        state.body = JSON.stringify(value);
        state.isBase64Encoded = false;
        return response;
      },
      send(value) {
        if (isWebRequest) {
          state.body = Buffer.isBuffer(value) ? value : String(value ?? '');
        } else {
          state.body = Buffer.isBuffer(value) ? value.toString('base64') : String(value ?? '');
          state.isBase64Encoded = Buffer.isBuffer(value);
        }
        return response;
      },
      end(value = '') {
        state.body = value === undefined || value === null ? '' : String(value);
        return response;
      },
    };

    const request = {
      method,
      headers,
      body,
      url,
      socket: { remoteAddress },
    };
    await handler(request, response);

    if (isWebRequest) {
      const nullBody = [204, 205, 304].includes(state.statusCode);
      return new Response(nullBody ? null : (state.body ?? ''), {
        status: state.statusCode,
        headers: state.headers,
      });
    }

    return {
      statusCode: state.statusCode,
      headers: state.headers,
      body: state.body ?? '',
      ...(state.isBase64Encoded ? { isBase64Encoded: true } : {}),
    };
  };
}
