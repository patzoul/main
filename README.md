# Live Maps

Interactive Leaflet maps with live data. Open [index.html](index.html) for the
full list.

## Maps

- **[world_earthquakes.html](world_earthquakes.html)** — global earthquakes, M2.5+, past 30 days
- **[japan_earthquakes.html](japan_earthquakes.html)** — Japan region (23–47°N, 120–150°E), M2.5+, past 30 days
- **[world_fires.html](world_fires.html)** — global active-fire / thermal-anomaly detections from [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) (VIIRS / MODIS), colored by fire radiative power, with satellite/day-range/intensity filters. Requires a free FIRMS proxy (see below)
- **[mideast_fires.html](mideast_fires.html)** — Middle East FIRMS fires overlaid on a curated list of major refineries / oil terminals, with **baseline change-detection**: a facility is flagged only when its current fire intensity spikes above its own recent baseline (so routine flaring stays quiet). Candidates, not confirmations. Uses the same FIRMS proxy
- **[russia_ukraine_fires.html](russia_ukraine_fires.html)** — the same FIRMS + change-detection monitor over the Russia–Ukraine theatre, with a curated list of Russian & Ukrainian refineries / oil terminals. Uses the same FIRMS proxy
- **[natural_events.html](natural_events.html)** — active natural events worldwide from [NASA EONET](https://eonet.gsfc.nasa.gov/) (volcanoes, severe storms, floods, icebergs, etc.), colored by category with clickable type toggles and storm/iceberg tracks. No key required
- **[weather_radar.html](weather_radar.html)** — animated global precipitation radar from [RainViewer](https://www.rainviewer.com/) (past ~2 h, playable loop with timeline scrub and opacity control). No key required
- **[malacca_ships.html](malacca_ships.html)** — live ship traffic in the Strait of Malacca via [aisstream.io](https://aisstream.io) AIS data
- **[world_ships.html](world_ships.html)** — live worldwide ship traffic (whole-globe AIS) via [aisstream.io](https://aisstream.io), rendered as lightweight canvas dots colored by vessel type
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
