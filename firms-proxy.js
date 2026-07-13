// ---------------------------------------------------------------------------
// FIRMS active-fire proxy — Cloudflare Worker
// ---------------------------------------------------------------------------
// NASA FIRMS requires a MAP_KEY and does NOT send CORS headers, so a browser
// can't call it directly. This tiny Worker holds the key server-side and adds
// CORS, so the static world_fires.html page can fetch active-fire data.
//
// Everything here is free: the FIRMS key is free, and the Cloudflare Workers
// free tier is plenty for this.
//
// ONE-TIME SETUP
//   1. Get a free FIRMS MAP_KEY: https://firms.modaps.eosdis.nasa.gov/api/area/
//      (enter your email; the key arrives instantly).
//   2. Create a Cloudflare account (free) → Workers & Pages → Create → Worker.
//   3. Replace the generated code with THIS file's contents and Deploy.
//   4. In the Worker's Settings → Variables and Secrets, add a *secret*:
//         Name:  FIRMS_MAP_KEY     Value: <your map key>
//      Deploy again so the secret is picked up.
//   5. Copy the Worker URL (https://firms-proxy.<you>.workers.dev) and paste it
//      into the World Wildfires map when it asks for it.
//
// If you deploy under a different Pages origin, add it to ALLOWED_ORIGINS below.
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  'https://patzoul.github.io',
  'http://localhost:8123',
  'http://127.0.0.1:8123',
];

// Only these FIRMS sources/params are allowed through, so the endpoint can't be
// abused to run arbitrary FIRMS queries against your key.
const SOURCES = ['VIIRS_NOAA20_NRT', 'VIIRS_SNPP_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'];

export default {
  async fetch(request, env) {
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

    const key = env.FIRMS_MAP_KEY;
    if (!key) return new Response('Server not configured: missing FIRMS_MAP_KEY secret', { status: 500, headers: cors });

    const p = new URL(request.url).searchParams;
    const source = p.get('source') || 'VIIRS_NOAA20_NRT';
    const area = p.get('area') || 'world';
    const day = p.get('day') || '1';

    if (!SOURCES.includes(source)) return new Response('Invalid source', { status: 400, headers: cors });
    if (!/^([1-9]|10)$/.test(day)) return new Response('Invalid day range (1-10)', { status: 400, headers: cors });
    const bboxOk = /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(area);
    if (area !== 'world' && !bboxOk) return new Response('Invalid area', { status: 400, headers: cors });

    const firmsUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${source}/${area}/${day}`;

    // Cache at the edge for 30 min — FIRMS NRT only refreshes a few times a day,
    // and this protects the key's 5000-requests / 10-min quota.
    let upstream;
    try {
      upstream = await fetch(firmsUrl, { cf: { cacheTtl: 1800, cacheEverything: true } });
    } catch (e) {
      return new Response('Upstream fetch failed: ' + e, { status: 502, headers: cors });
    }
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, max-age=1800',
        ...cors,
      },
    });
  },
};
