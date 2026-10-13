export function toNetlify(handler) {
  return async (event) => {
    let body = event.body || '';
    if (event.isBase64Encoded && body) body = Buffer.from(body, 'base64').toString('utf8');
    if (body && typeof body === 'string' && /application\/json/i.test(event.headers?.['content-type'] || '')) {
      try { body = JSON.parse(body); } catch { /* the wrapped handler will validate it */ }
    }

    const state = { statusCode: 200, headers: {}, body: '' };
    const response = {
      setHeader(name, value) { state.headers[name] = String(value); },
      status(code) { state.statusCode = code; return response; },
      json(value) {
        state.headers['Content-Type'] = 'application/json; charset=utf-8';
        state.body = JSON.stringify(value);
        return response;
      },
      send(value) {
        state.body = Buffer.isBuffer(value) ? value.toString('base64') : String(value ?? '');
        state.isBase64Encoded = Buffer.isBuffer(value);
        return response;
      },
      end(value = '') { state.body = String(value); return response; },
    };

    const request = {
      method: event.httpMethod,
      headers: Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value])),
      body,
      url: event.rawUrl || event.path || '/',
      socket: { remoteAddress: event.requestContext?.identity?.sourceIp || '' },
    };
    await handler(request, response);
    return {
      statusCode: state.statusCode,
      headers: state.headers,
      body: state.body,
      ...(state.isBase64Encoded ? { isBase64Encoded: true } : {}),
    };
  };
}
