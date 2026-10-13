function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function supabaseRequest(table, params, serviceKey) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const query = new URLSearchParams(params).toString();
  return fetch(`${base}/rest/v1/${table}?${query}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    signal: AbortSignal.timeout(12000),
  });
}

export default async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !serviceKey) {
    return json(503, { error: 'Service Supabase non configuré.', code: 'BACKEND_NOT_CONFIGURED' });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'JSON invalide.' }); }
  const styleIds = Array.isArray(body.styleIds)
    ? [...new Set(body.styleIds.map(id => String(id).trim()).filter(id => /^[A-Za-z0-9_-]+$/.test(id)))].slice(0, 500)
    : [];
  if (!styleIds.length) return json(200, { stats: {} });

  const stats = Object.fromEntries(styleIds.map(id => [id, { likes: 0, views: 0, shares: 0 }]));
  let partial = false;
  try {
    let response = await supabaseRequest('Style', {
      select: 'id,views,shares',
      id: `in.(${styleIds.join(',')})`,
    }, serviceKey);
    if (!response.ok) {
      response = await supabaseRequest('Style', {
        select: 'id,views',
        id: `in.(${styleIds.join(',')})`,
      }, serviceKey);
    }
    if (response.ok) {
      const styles = await response.json();
      (Array.isArray(styles) ? styles : []).forEach(style => {
        const id = String(style.id);
        if (stats[id]) {
          stats[id].views = Number(style.views || 0);
          stats[id].shares = Number(style.shares || 0);
        }
      });
    } else partial = true;
  } catch { partial = true; }

  try {
    const response = await supabaseRequest('user_like', {
      select: 'target_id',
      target_type: 'eq.style',
      target_id: `in.(${styleIds.join(',')})`,
    }, serviceKey);
    if (response.ok) {
      const likes = await response.json();
      (Array.isArray(likes) ? likes : []).forEach(row => {
        const id = String(row.target_id);
        if (stats[id]) stats[id].likes += 1;
      });
    } else partial = true;
  } catch { partial = true; }

  return json(200, { stats, partial });
}
