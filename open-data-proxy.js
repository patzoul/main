// ---------------------------------------------------------------------------
// Open-data CORS proxy — Cloudflare Worker
// ---------------------------------------------------------------------------
// GDELT is free and keyless, but sends no CORS headers, so a browser can't
// call it directly. This Worker just adds CORS and edge-caches the response.
// Unlike firms-proxy.js, it holds no secret: there's no key to protect, only
// an allowlist of upstream targets.
//
// Powers: unrest_events.html (GDELT unrest/protest theme mentions).
//
// This Worker originally also proxied OpenSky (for world_aircraft.html), but
// OpenSky blocks Cloudflare's IP ranges at the network level — every request
// through here got a Cloudflare 522 (connection timeout), even after adding
// a browser User-Agent, while a direct request from an ordinary host
// succeeded immediately. That page now reads a snapshot fetched hourly by
// a GitHub Actions runner instead — see scripts/fetch-aircraft-snapshot.mjs.
//
// ONE-TIME SETUP
//   1. Create a Cloudflare account (free) → Workers & Pages → Create → Worker.
//      (Skip this if you already made one for firms-proxy.js — just add a
//      second Worker under the same account.)
//   2. Replace the generated code with THIS file's contents and Deploy.
//   3. Copy the Worker URL (https://open-data-proxy.<you>.workers.dev) and
//      paste it into unrest_events.html when it asks for it.
//
// If you deploy under a different Pages origin, add it to ALLOWED_ORIGINS below.
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  'https://patzoul.github.io',
  'http://localhost:8123',
  'http://127.0.0.1:8123',
];

const GDELT_THEMES = ['PROTEST', 'STRIKE', 'VIOLENT_UNREST'];
const GDELT_MAX_ROWS_CAP = 500;

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    const cors = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: cors });

    const p = new URL(request.url).searchParams;
    const target = p.get('target');

    if (target === 'gdelt') return handleGdelt(p, cors);
    return new Response('Unknown target — expected ?target=gdelt', { status: 400, headers: cors });
  },
};

async function handleGdelt(p, cors) {
  const theme = p.get('theme') || 'PROTEST';
  if (!GDELT_THEMES.includes(theme)) return new Response('Invalid theme', { status: 400, headers: cors });
  const maxrows = Math.min(parseInt(p.get('maxrows') || '250', 10) || 250, GDELT_MAX_ROWS_CAP);

  const url = `https://api.gdeltproject.org/api/v1/gkg_geojson?QUERY=${theme}&MAXROWS=${maxrows}`;

  // GDELT's GKG feed refreshes every ~15 min — cache 10 min so the map stays
  // reasonably fresh without re-hitting GDELT on every page load.
  let upstream;
  try {
    upstream = await fetch(url, { cf: { cacheTtl: 600, cacheEverything: true } });
  } catch (e) {
    return new Response('Upstream fetch failed: ' + e, { status: 502, headers: cors });
  }
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600', ...cors },
  });
}
