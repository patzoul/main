// ---------------------------------------------------------------------------
// Fire anomaly alert — runs on a schedule (see .github/workflows/fire-alert.yml)
// ---------------------------------------------------------------------------
// Fetches NASA FIRMS active-fire data for two theatres, runs the same baseline
// change-detection as the interactive maps, and opens a GitHub issue (assigned
// to the maintainer, who is then emailed by GitHub) when a facility burns well
// above its own recent baseline. Candidates, not confirmations.
//
// Env: FIRMS_MAP_KEY (secret), GH_TOKEN (the workflow's GITHUB_TOKEN),
//      GITHUB_REPOSITORY (owner/repo, set automatically by Actions).
// ---------------------------------------------------------------------------

const SOURCE = 'VIIRS_NOAA20_NRT';
const DAYS = 7;             // history window for the baseline
const RADIUS_KM = 10;       // detection-to-facility match radius
const FLOOR = 50;           // MW — min current intensity to alert (stricter than the maps)
const SENS = 4;             // ratio — current must be >= SENS x baseline to alert
const ASSIGNEE = 'patzoul';

const THEATRES = [
  { name: 'Middle East', bbox: '25,12,63,42', facilities: [
    {n:'Ras Tanura Refinery/Terminal (SA)', lat:26.70, lon:50.05},
    {n:'Abqaiq Processing (SA)', lat:25.93, lon:49.68},
    {n:'Jeddah Refinery (SA)', lat:21.35, lon:39.17},
    {n:'Yanbu Refinery/Terminal (SA)', lat:24.06, lon:38.06},
    {n:'Riyadh Refinery (SA)', lat:24.55, lon:46.86},
    {n:'Jubail Refinery (SA)', lat:27.00, lon:49.60},
    {n:'Rabigh Refinery (SA)', lat:22.80, lon:39.03},
    {n:'Ruwais Refinery (UAE)', lat:24.11, lon:52.73},
    {n:'Jebel Ali (UAE)', lat:25.00, lon:55.06},
    {n:'Fujairah Oil Terminal (UAE)', lat:25.15, lon:56.36},
    {n:'Abadan Refinery (Iran)', lat:30.34, lon:48.29},
    {n:'Isfahan Refinery (Iran)', lat:32.75, lon:51.55},
    {n:'Bandar Abbas Refinery (Iran)', lat:27.35, lon:56.28},
    {n:'Tehran Refinery (Iran)', lat:35.55, lon:51.44},
    {n:'Kharg Island Terminal (Iran)', lat:29.26, lon:50.33},
    {n:'Tabriz Refinery (Iran)', lat:38.12, lon:46.20},
    {n:'Arak Refinery (Iran)', lat:34.08, lon:49.75},
    {n:'Mina Al-Ahmadi Refinery (Kuwait)', lat:29.07, lon:48.13},
    {n:'Mina Abdullah Refinery (Kuwait)', lat:29.02, lon:48.16},
    {n:'Al-Zour Refinery (Kuwait)', lat:28.72, lon:48.38},
    {n:'Baiji Refinery (Iraq)', lat:34.93, lon:43.49},
    {n:'Shuaiba/Basra Refinery (Iraq)', lat:30.43, lon:47.71},
    {n:'Daura Refinery, Baghdad (Iraq)', lat:33.27, lon:44.28},
    {n:'Ras Laffan (Qatar)', lat:25.91, lon:51.57},
    {n:'Mesaieed (Qatar)', lat:24.98, lon:51.57},
    {n:'Sitra Refinery (Bahrain)', lat:26.15, lon:50.63},
    {n:'Sohar Refinery (Oman)', lat:24.49, lon:56.63},
    {n:'Mina Al Fahal, Muscat (Oman)', lat:23.63, lon:58.52},
    {n:'Suez Refineries (Egypt)', lat:29.95, lon:32.55},
    {n:'Mostorod Refinery, Cairo (Egypt)', lat:30.15, lon:31.27},
    {n:'Alexandria Refinery (Egypt)', lat:31.15, lon:29.82},
    {n:'Haifa Refinery (Israel)', lat:32.80, lon:35.05},
    {n:'Ashdod Refinery (Israel)', lat:31.83, lon:34.65},
    {n:'Zarqa Refinery (Jordan)', lat:32.08, lon:36.11},
    {n:'Homs Refinery (Syria)', lat:34.75, lon:36.72},
    {n:'Banias Refinery (Syria)', lat:35.24, lon:35.95},
    {n:'Aden Refinery (Yemen)', lat:12.80, lon:44.99}
  ]},
  { name: 'Russia–Ukraine', bbox: '22,43,65,62', facilities: [
    {n:'Ryazan Refinery (RU)', lat:54.60, lon:39.66},
    {n:'Moscow Refinery, Kapotnya (RU)', lat:55.65, lon:37.79},
    {n:'Yaroslavl / YANOS Refinery (RU)', lat:57.55, lon:39.95},
    {n:'Kstovo / Nizhny Novgorod Refinery (RU)', lat:56.15, lon:44.22},
    {n:'Kirishi Refinery (RU)', lat:59.45, lon:32.02},
    {n:'Volgograd Refinery (RU)', lat:48.62, lon:44.55},
    {n:'Saratov Refinery (RU)', lat:51.48, lon:46.10},
    {n:'Syzran Refinery (RU)', lat:53.16, lon:48.44},
    {n:'Novokuibyshevsk Refinery (RU)', lat:53.10, lon:49.95},
    {n:'Kuibyshev / Samara Refinery (RU)', lat:53.15, lon:50.20},
    {n:'Nizhnekamsk / TANECO Refinery (RU)', lat:55.70, lon:51.80},
    {n:'Ufa Refineries (RU)', lat:54.82, lon:56.05},
    {n:'Salavat Refinery (RU)', lat:53.35, lon:55.92},
    {n:'Orsk Refinery (RU)', lat:51.25, lon:58.60},
    {n:'Perm Refinery (RU)', lat:58.00, lon:56.20},
    {n:'Tuapse Refinery (RU)', lat:44.09, lon:39.08},
    {n:'Novorossiysk / Sheskharis Terminal (RU)', lat:44.70, lon:37.80},
    {n:'Afipsky Refinery (RU)', lat:44.90, lon:38.84},
    {n:'Ilsky Refinery (RU)', lat:44.84, lon:38.57},
    {n:'Slavyansk-na-Kubani Refinery (RU)', lat:45.26, lon:38.13},
    {n:'Krasnodar Refinery (RU)', lat:45.05, lon:39.00},
    {n:'Novoshakhtinsk Refinery (RU)', lat:47.78, lon:39.85},
    {n:'Astrakhan Gas Processing (RU)', lat:46.32, lon:48.05},
    {n:'Ust-Luga Terminal (RU)', lat:59.67, lon:28.28},
    {n:'Primorsk Oil Terminal (RU)', lat:60.35, lon:28.62},
    {n:'Feodosia Oil Terminal (Crimea)', lat:45.05, lon:35.40},
    {n:'Kremenchuk Refinery (UA)', lat:49.05, lon:33.43},
    {n:'Drohobych Refinery (UA)', lat:49.35, lon:23.51},
    {n:'Kherson Refinery (UA)', lat:46.63, lon:32.62},
    {n:'Odesa Oil Terminals (UA)', lat:46.48, lon:30.74},
    {n:'Lysychansk Refinery (UA)', lat:48.92, lon:38.43}
  ]}
];

export function haversine(a, b, c, d) {
  const R = 6371, p = Math.PI / 180;
  const dLat = (c - a) * p, dLon = (d - b) * p;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function parseFirmsCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines[0] || !lines[0].includes('latitude')) return null;
  const h = lines[0].split(',').map(s => s.trim()), idx = {};
  h.forEach((x, i) => idx[x] = i);
  const rows = [];
  for (let k = 1; k < lines.length; k++) {
    const c = lines[k].split(',');
    const lat = parseFloat(c[idx.latitude]), lon = parseFloat(c[idx.longitude]);
    if (isNaN(lat) || isNaN(lon)) continue;
    rows.push({ lat, lon, frp: parseFloat(c[idx.frp]) || 0, date: c[idx.acq_date], time: c[idx.acq_time], dn: c[idx.daynight] });
  }
  return rows;
}

// Per facility: max FRP per day (0-filled), baseline = median of the pre-current
// days, current = latest day. Flag when current >= FLOOR and current/(baseline+1) >= SENS.
export function computeAnomalies(facilities, rows, { radiusKm = RADIUS_KM, floor = FLOOR, sens = SENS } = {}) {
  const dates = [...new Set(rows.map(r => r.date).filter(Boolean))].sort();
  if (dates.length < 2) return [];
  const out = [];
  for (const f of facilities) {
    const perDate = {}; dates.forEach(d => perDate[d] = 0);
    let lastDet = null;
    for (const r of rows) {
      if (!r.date) continue;
      if (haversine(r.lat, r.lon, f.lat, f.lon) <= radiusKm) {
        if (r.frp > perDate[r.date]) perDate[r.date] = r.frp;
        const stamp = r.date + String(r.time).padStart(4, '0');
        if (!lastDet || stamp > (lastDet.date + String(lastDet.time).padStart(4, '0'))) lastDet = r;
      }
    }
    const series = dates.map(d => perDate[d]);
    const current = series[series.length - 1];
    const baseline = median(series.slice(0, -1));
    const ratio = current / (baseline + 1);
    if (current >= floor && ratio >= sens) out.push({ f, current, baseline, ratio, lastDet, date: dates[dates.length - 1] });
  }
  return out;
}

async function firmsFetch(bbox) {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) throw new Error('FIRMS_MAP_KEY not set');
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${SOURCE}/${bbox}/${DAYS}`;
  const res = await fetch(url);
  const text = await res.text();
  const rows = parseFirmsCsv(text);
  if (rows === null) throw new Error('FIRMS returned non-CSV: ' + text.slice(0, 140));
  return rows;
}

async function gh(path, opts = {}) {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'fire-alert',
      ...(opts.headers || {})
    }
  });
  return res;
}

const keyOf = a => `${a.theatre}|${a.f.n}|${a.date}`;
const fmtWhen = r => r ? `${r.date} ${String(r.time).padStart(4, '0')} UTC` : '—';

async function main() {
  const flagged = [];
  for (const t of THEATRES) {
    try {
      const rows = await firmsFetch(t.bbox);
      for (const a of computeAnomalies(t.facilities, rows)) flagged.push({ theatre: t.name, ...a });
    } catch (e) {
      console.error(`[${t.name}] ${e.message}`);
    }
  }
  flagged.sort((a, b) => b.ratio - a.ratio);

  if (!flagged.length) { console.log('No anomalies above threshold.'); return; }

  // Dedupe against still-open alert issues (keyed by theatre|facility|date), so
  // an ongoing fire re-alerts at most once per UTC day.
  let existing = new Set();
  try {
    const r = await gh('/issues?state=open&labels=fire-alert&per_page=100');
    if (r.ok) {
      const issues = await r.json();
      for (const iss of issues) {
        const m = (iss.body || '').match(/<!-- keys:\s*(.+?)\s*-->/);
        if (m) m[1].split(';').forEach(k => existing.add(k.trim()));
      }
    }
  } catch (e) { console.error('list issues:', e.message); }

  const fresh = flagged.filter(a => !existing.has(keyOf(a)));
  if (!fresh.length) { console.log(`${flagged.length} anomaly(ies), all already reported.`); return; }

  await gh('/labels', { method: 'POST', body: JSON.stringify({ name: 'fire-alert', color: 'd73a4a', description: 'Automated FIRMS fire-anomaly alert' }) }).catch(() => {});

  const rowsMd = fresh.map(a =>
    `| ${a.f.n} | ${a.theatre} | **${a.current.toFixed(0)} MW** | ${a.baseline.toFixed(0)} MW | ${a.ratio.toFixed(1)}× | ${a.lastDet && a.lastDet.dn === 'N' ? 'night' : 'day'} | ${fmtWhen(a.lastDet)} |`
  ).join('\n');
  const top = fresh[0];
  const title = `🔥 Fire anomaly: ${top.f.n} — ${top.current.toFixed(0)} MW (${top.ratio.toFixed(0)}× baseline)`;
  const body =
`Automated NASA FIRMS change-detection flagged **${fresh.length}** facilit${fresh.length > 1 ? 'ies' : 'y'} burning well above baseline (current ≥ ${FLOOR} MW and ≥ ${SENS}× the site's ${DAYS}-day baseline).

| Facility | Theatre | Now | Baseline | Ratio | Day/night | Last detection |
|---|---|---|---|---|---|---|
${rowsMd}

**Candidates, not confirmations.** Routine flaring/process upsets can look similar and NRT data is partial. Verify with reporting before drawing conclusions.

Source: NASA FIRMS (${SOURCE}, ${DAYS}-day window). See the maps: \`mideast_fires.html\` / \`russia_ukraine_fires.html\`.

<!-- keys: ${fresh.map(keyOf).join('; ')} -->`;

  const r = await gh('/issues', { method: 'POST', body: JSON.stringify({ title, body, labels: ['fire-alert'], assignees: [ASSIGNEE] }) });
  if (r.ok) console.log(`Opened alert issue for ${fresh.length} anomaly(ies).`);
  else console.error('create issue failed:', r.status, (await r.text()).slice(0, 200));
}

// Run main only when executed directly (not when imported for testing).
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/fire-alert.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
