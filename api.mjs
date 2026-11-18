import core from './recommendations.cjs';
import catalog from './songlist.json' with { type: 'json' };

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', ...headers }
  });
}

function parseDay(params, now) {
  const keys = [...params.keys()];
  if (keys.length === 0) return core.dayIndex(now);
  if (keys.length !== 1) throw new Error('Supply at most one date or seed.');

  const key = keys[0];
  const value = params.get(key);
  if (key === 'seed') {
    if (!/^\d+$/.test(value)) throw new Error('seed must be a decimal integer.');
    return Number(value);
  }
  if (key !== 'date') throw new Error('Use date or seed.');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('date must use YYYY-MM-DD.');
  const midnight = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== value) {
    throw new Error('date must be a valid calendar date.');
  }

  // The UTC calendar-day index equals the recommendation index starting at 05:00 KST.
  return core.dayIndex(midnight);
}

export function handleRequest(request, now = Date.now()) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/recommendations') return json({ error: 'Not found.' }, 404);
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405, { Allow: 'GET' });

  let seed;
  try {
    seed = parseDay(url.searchParams, now);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  if (!core.isDayIndex(seed)) return json({ error: 'Invalid or unsupported day index.' }, 400);
  return json(core.recommendationResponse(catalog.songs, seed));
}
