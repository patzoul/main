#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Fetch a worldwide OpenSky Network aircraft-position snapshot and write it
// to aircraft_snapshot.json at the repo root.
//
// world_aircraft.html reads that file directly (same-origin, no CORS issue).
// A live in-browser proxy was tried first (open-data-proxy.js), but OpenSky
// blocks Cloudflare's IP ranges at the network level (a Cloudflare 522 on
// every attempt, while a direct request from an ordinary host succeeds
// immediately) — a scheduled fetch from a GitHub Actions runner sidesteps
// that entirely, at the cost of "every ~15 min" instead of true live polling.
//
// Run via .github/workflows/update-aircraft-snapshot.yml.
// ---------------------------------------------------------------------------

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OPENSKY_URL = 'https://opensky-network.org/api/states/all';
const OUT_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'aircraft_snapshot.json');

const round = (n, dp) => (n == null ? null : Math.round(n * 10 ** dp) / 10 ** dp);

// Field order per OpenSky's documented state-vector schema:
// https://openskynetwork.github.io/opensky-api/rest.html#response
// Trimmed to what world_aircraft.html actually renders (drops
// sensors/squawk/spi/position_source) and rounded to map-relevant precision
// (~111 m for lat/lon, whole units for altitude/speed/heading/climb-rate) —
// this is a committed file refreshed on a schedule, so keeping it small
// keeps repo growth and diff noise down.
function trimState(s) {
  return [
    s[0],                 // icao24
    (s[1] || '').trim() || null, // callsign
    s[2],                 // origin_country
    round(s[5], 3),        // longitude
    round(s[6], 3),        // latitude
    round(s[7] != null ? s[7] : s[13], 0), // baro_altitude, falling back to geo_altitude
    s[8],                  // on_ground
    round(s[9], 0),        // velocity
    round(s[10], 0),       // true_track
    round(s[11], 0),       // vertical_rate
  ];
}

async function main() {
  const resp = await fetch(OPENSKY_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });
  if (!resp.ok) throw new Error(`OpenSky HTTP ${resp.status}`);
  const data = await resp.json();
  const states = (data.states || [])
    .filter((s) => s[5] != null && s[6] != null)
    .map(trimState);

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    openskyTime: data.time || null,
    count: states.length,
    // [icao24, callsign, origin_country, lon, lat, altM, on_ground, velocityMs, trueTrack, verticalRate]
    states,
  };

  await writeFile(OUT_FILE, JSON.stringify(snapshot));
  console.log(`Wrote ${states.length.toLocaleString()} aircraft to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('fetch-aircraft-snapshot failed:', err);
  process.exit(1);
});
