# Live Maps

Interactive Leaflet maps with live data. Open [index.html](index.html) for the
full list.

## Maps

- **[world_earthquakes.html](world_earthquakes.html)** — global earthquakes, M2.5+, past 30 days
- **[japan_earthquakes.html](japan_earthquakes.html)** — Japan region (23–47°N, 120–150°E), M2.5+, past 30 days
- **[world_fires.html](world_fires.html)** — global active-fire / thermal-anomaly detections from [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) (VIIRS / MODIS), colored by fire radiative power, with satellite/day-range/intensity filters. Requires a free FIRMS proxy (see below)
- **[mideast_fires.html](mideast_fires.html)** — Middle East FIRMS fires overlaid on a curated list of major refineries / oil terminals, with **baseline change-detection**: a facility is flagged only when its current fire intensity spikes above its own recent baseline (so routine flaring stays quiet). Candidates, not confirmations. Uses the same FIRMS proxy
- **[russia_ukraine_fires.html](russia_ukraine_fires.html)** — the same FIRMS + change-detection monitor over the Russia–Ukraine theatre, with a curated list of Russian & Ukrainian refineries / oil terminals. Uses the same FIRMS proxy
- **[fire_danger.html](fire_danger.html)** — worldwide **fire danger forecast** (not detections) from [Copernicus GWIS](https://gwis.jrc.ec.europa.eu/) — the Canadian Fire Weather Index, driven by ECMWF weather forecasts, selectable today through +9 days. Served as WMS tiles with CORS already enabled — no key or proxy needed
- **[ebola_africa.html](ebola_africa.html)** — the progress of Ebola virus disease (EVD) outbreaks across Africa from 1976 to the present, on a **playable timeline**: a **dual-handle time window** (start / end) selects the period shown — it opens on the latest outbreak (start = the 2026 epidemic's onset, end = today) and you drag either handle to widen back through history: year by year across the older record, then month by month near the present (the end handle can't move before the start). Outbreaks are sized by reported cases (log scale) and colored by virus species (Zaire / Sudan / Bundibugyo / Taï Forest). A **minimum-cases slider** (like the earthquake map's min-magnitude control) filters out smaller flare-ups to isolate the major epidemics. The running **active 2026 Central Africa epidemic** (Bundibugyo virus, DR Congo & Uganda) is broken out by province and highlighted. Curated from [CDC](https://www.cdc.gov/ebola/outbreaks/) & [WHO](https://www.who.int/) reporting; self-contained, no key required
- **[unrest_events.html](unrest_events.html)** — global protest / strike / violent-unrest theme mentions from [GDELT](https://www.gdeltproject.org/)'s Global Knowledge Graph, colored by theme and by article tone, with a coarse-geocode filter to cut country-level noise. Candidates, not confirmations — see below. Requires the shared open-data proxy (see below)
- **[natural_events.html](natural_events.html)** — active natural events worldwide from [NASA EONET](https://eonet.gsfc.nasa.gov/) (volcanoes, severe storms, floods, icebergs, etc.), colored by category with clickable type toggles and storm/iceberg tracks. No key required
- **[weather_radar.html](weather_radar.html)** — animated global precipitation radar from [RainViewer](https://www.rainviewer.com/) (past ~2 h, playable loop with timeline scrub and opacity control). No key required
- **[malacca_ships.html](malacca_ships.html)** — live ship traffic in the Strait of Malacca via [aisstream.io](https://aisstream.io) AIS data
- **[world_ships.html](world_ships.html)** — live worldwide ship traffic (whole-globe AIS) via [aisstream.io](https://aisstream.io), rendered as lightweight canvas dots colored by vessel type
- **[world_aircraft.html](world_aircraft.html)** — worldwide aircraft positions from the [OpenSky Network](https://opensky-network.org/), colored by altitude band (ground / low / mid / cruise). An hourly snapshot, not live — see below
- **[submarine_cables.html](submarine_cables.html)** — global submarine cable routes, landing points, and documented damage incidents (2024–2025), data from [TeleGeography](https://www.submarinecablemap.com)
- **[electricity_map.html](electricity_map.html)** — world heatmap of average residential electricity price by country, with a live generation-mix breakdown (coal, gas, nuclear, hydro, wind, solar…) on hover

The earthquake maps:

- Fetch live data from the USGS earthquake API on load (requires internet)
- Size bubbles by magnitude, color by depth (shallow/intermediate/deep)
- Show a hover tooltip with location, magnitude, depth, time, and event type
- Include a minimum-magnitude slider to filter events

The Malacca and world ship maps connect to aisstream.io over a WebSocket and
plot live vessel positions, headings, and short tracks. Each requires a free
aisstream.io API key — entered once in the browser and stored only in
`localStorage`, never written to any file in this repo.

The wildfire map streams live active-fire detections from NASA FIRMS
(VIIRS / MODIS). FIRMS requires a key and blocks direct browser access (no CORS),
so requests go through a tiny **free Cloudflare Worker** proxy that holds the key
server-side and adds CORS. The Worker code and one-time setup steps are in
[`firms-proxy.js`](firms-proxy.js); once deployed, paste its URL into the map
(stored only in `localStorage`). Everything is free — the FIRMS key and the
Workers free tier both cost nothing.

The fire danger forecast map (`ecmwf.fwi`, the Fire Weather Index) is served
as WMS tiles from `maps.effis.emergency.copernicus.eu`, which unlike
FIRMS/GDELT/OpenSky **already sends `Access-Control-Allow-Origin: *`**, so it
needs no proxy or key at all — the simplest data source in this repo. That
exact host matters: `ies-ows.jrc.ec.europa.eu/gwis` looks like the more
"official" GWIS API endpoint and serves the same layer name, but its current
data silently stopped updating sometime after early 2025 (confirmed with an
exact MD5 match between an unparameterized request and an explicit
`TIME=2019-01-01` one — it was quietly falling back to a stale declared
default, not erroring). The real host was found by loading GWIS's own
["Current Situation" viewer](https://gwis.jrc.ec.europa.eu/apps/gwis_current_situation/index.html)
and reading its live Leaflet layer objects directly, since the actual API
calls aren't visible in the app's static HTML.

The unrest map reads from GDELT — free and keyless, but it sends no CORS
headers, so a browser can't call it directly. It goes through
[`open-data-proxy.js`](open-data-proxy.js), a second **free Cloudflare
Worker** that just adds CORS and edge-caches the response for 10 min. Unlike
`firms-proxy.js` it holds no secret — there's no key to protect, only an
allowlist of upstream targets. Deploy it once the same way (Cloudflare
Workers & Pages → Create → Worker → paste the file's contents → Deploy) and
paste its URL into `unrest_events.html` (stored only in `localStorage`).
GDELT's unrest data is theme-mention geocoding, not a curated event database:
one article can geocode to several places (e.g. a country named only in
passing), so country-level ("coarse") mentions are hidden by default — toggle
them back on if you want the raw feed.

The aircraft map is **not live** — it reads a worldwide OpenSky Network
snapshot committed to [`aircraft_snapshot.json`](aircraft_snapshot.json). A
live in-browser proxy through `open-data-proxy.js` was tried first (the same
approach as GDELT), but OpenSky blocks Cloudflare's IP ranges at the network
level — every request through the Worker got a Cloudflare 522 (connection
timeout), even after adding a browser User-Agent, while a direct request from
an ordinary host succeeded immediately. A scheduled GitHub Actions job
(`.github/workflows/update-aircraft-snapshot.yml` →
[`scripts/fetch-aircraft-snapshot.mjs`](scripts/fetch-aircraft-snapshot.mjs))
fetches from a GitHub-hosted runner instead — unaffected by that block — and
commits the trimmed result hourly. No key or proxy needed; the panel shows
how stale the current snapshot is. Hourly (not more often) keeps the
committed ~800 KB snapshot from growing the repo too fast — bump the cron in
the workflow if you'd rather trade repo growth for freshness.

The two "fire watch" maps (Middle East, Russia–Ukraine) add **baseline
change-detection**: for each refinery/terminal they compare the current fire
intensity against the site's own recent baseline, flagging only genuine spikes
(so routine gas flaring stays quiet). A scheduled GitHub Actions job
(`.github/workflows/fire-alert.yml` → [`scripts/fire-alert.mjs`](scripts/fire-alert.mjs))
runs the same check server-side every few hours and **opens a GitHub issue
(assigned to the maintainer, who is then emailed by GitHub)** when a facility
burns well above baseline. One-time setup: add a `FIRMS_MAP_KEY` repo secret
(your free FIRMS key). Candidates, not confirmations — routine flaring/upsets
can look similar; verify with reporting.

The submarine cable map plots all cable routes and landing points from
`cable-geo.json` / `landing-point-geo.json` (© TeleGeography, CC BY-NC-SA 3.0),
with markers for documented cable-damage incidents loaded from
`cable_incidents.json` — clicking an incident in the side panel flies to its
location and opens a popup with details and sources.

The incident list is hand-curated from public news reporting (there is no
structured feed for cable damage). A monthly GitHub Actions job
(`.github/workflows/update-cable-incidents.yml`) uses the Claude Code Action to
research candidate new incidents and **open a pull request** for human review —
it never commits to `main`. One-time setup: run `claude setup-token` (needs a
Claude Pro/Max subscription) and add the result as a `CLAUDE_CODE_OAUTH_TOKEN`
repo secret, and enable Settings → Actions → General → "Allow GitHub Actions to
create and approve pull requests".

The Ebola map is a self-contained Leaflet timeline. Because there is no free
live feed for outbreak counts, the outbreak list is **curated and embedded in
the file** — every significant African EVD outbreak from the first (1976,
Yambuku, then Zaire) through the ongoing 2026 Central Africa epidemic — compiled
from the CDC "History of Ebola Outbreaks" chronology and WHO Disease Outbreak
News. Each entry carries the year, country, location, virus species, and
cumulative reported cases/deaths. A **dual-handle time window** picks the period
shown: it opens on the latest outbreak (start = the 2026 epidemic's onset, end =
today) and either handle drags to widen the window back through history — year
by year across the older record, then month by month near the present (the end
handle can't move before the start). The stats panel totals the cases, deaths,
and case-fatality rate for the window, and **Play** sweeps the end handle forward
to animate the progression. The ongoing **2026 Central Africa epidemic** carries
a monthly case series, so pulling the end handle across its months (May → Jun →
now) grows its bubbles and stats **as of that date** as the outbreak spreads
across the provinces. Its epidemic-wide monthly totals are the
figures reported by WHO (≈128 cases end-May, ≈623 mid-June, ≈2,500 by late
July); the per-province split of those monthly totals is reconstructed (only the
latest per-province breakdown is reported). Recent and ongoing figures are
provisional, and imported/index cases outside Africa (e.g. the 2014 US/Europe
cases) are not plotted. To refresh the numbers as the situation evolves, edit
the `OUTBREAKS` array near the top of
[`ebola_africa.html`](ebola_africa.html).

The electricity map (Plotly choropleth) colours each country by its residential
electricity price (USD/kWh); countries without price data are greyed. The price
layer is a periodic snapshot from GlobalPetrolPrices baked into the file — there
is no free worldwide live price feed. The generation mix shown on hover is
fetched live from [Our World in Data](https://ourworldindata.org/electricity-mix)
each time the map opens (with the bundled snapshot as an offline fallback).

Open any `.html` file directly in a browser.

## Regenerating

`generate_earthquake_maps.ps1` downloads fresh USGS GeoJSON snapshots (for archival)
and rewrites both HTML files, then copies everything to the OneDrive folder.

```powershell
.\generate_earthquake_maps.ps1
```

The electricity map regenerates with Python (downloads its source data on first
run, then rebuilds the self-contained HTML):

```powershell
python build_data.py   # -> mapdata.json
python build_html.py   # -> electricity_map.html
```
