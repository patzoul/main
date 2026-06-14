# Live Maps

Interactive Leaflet maps with live data. Open [index.html](index.html) for the
full list.

## Maps

- **[world_earthquakes.html](world_earthquakes.html)** — global earthquakes, M2.5+, past 30 days
- **[japan_earthquakes.html](japan_earthquakes.html)** — Japan region (23–47°N, 120–150°E), M2.5+, past 30 days
- **[hormuz_ships.html](hormuz_ships.html)** — live ship traffic in the Strait of Hormuz via [aisstream.io](https://aisstream.io) AIS data
- **[malacca_ships.html](malacca_ships.html)** — live ship traffic in the Strait of Malacca via [aisstream.io](https://aisstream.io) AIS data
- **[submarine_cables.html](submarine_cables.html)** — global submarine cable routes, landing points, and documented damage incidents (2024–2025), data from [TeleGeography](https://www.submarinecablemap.com)
- **[electricity_map.html](electricity_map.html)** — world heatmap of average residential electricity price by country, with a live generation-mix breakdown (coal, gas, nuclear, hydro, wind, solar…) on hover

The earthquake maps:

- Fetch live data from the USGS earthquake API on load (requires internet)
- Size bubbles by magnitude, color by depth (shallow/intermediate/deep)
- Show a hover tooltip with location, magnitude, depth, time, and event type
- Include a minimum-magnitude slider to filter events

The Hormuz and Malacca ship maps connect to aisstream.io over a WebSocket and
plot live vessel positions, headings, and short tracks. Each requires a free
aisstream.io API key — entered once in the browser and stored only in
`localStorage`, never written to any file in this repo.

The submarine cable map plots all cable routes and landing points from
`cable-geo.json` / `landing-point-geo.json` (© TeleGeography, CC BY-NC-SA 3.0),
with markers for documented cable-damage incidents loaded from
`cable_incidents.json` — clicking an incident in the side panel flies to its
location and opens a popup with details and sources.

The incident list is hand-curated from public news reporting (there is no
structured feed for cable damage). A monthly GitHub Actions job
(`.github/workflows/update-cable-incidents.yml`) uses the Claude Code Action to
research candidate new incidents and **open a pull request** for human review —
it never commits to `main`. One-time setup: add an `ANTHROPIC_API_KEY` repo
secret, and enable Settings → Actions → General → "Allow GitHub Actions to
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
