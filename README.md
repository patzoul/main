# Live Maps

Interactive Leaflet maps with live data. Open [index.html](index.html) for the
full list.

## Maps

- **[world_earthquakes.html](world_earthquakes.html)** — global earthquakes, M2.5+, past 30 days
- **[japan_earthquakes.html](japan_earthquakes.html)** — Japan region (23–47°N, 120–150°E), M2.5+, past 30 days
- **[hormuz_ships.html](hormuz_ships.html)** — live ship traffic in the Strait of Hormuz via [aisstream.io](https://aisstream.io) AIS data
- **[malacca_ships.html](malacca_ships.html)** — live ship traffic in the Strait of Malacca via [aisstream.io](https://aisstream.io) AIS data
- **[submarine_cables.html](submarine_cables.html)** — global submarine cable routes, landing points, and documented damage incidents (2024–2025), data from [TeleGeography](https://www.submarinecablemap.com)

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
with markers for ~8 documented cable-damage incidents from 2024–2025 —
clicking an incident in the side panel flies to its location and opens a
popup with details and sources.

Open any `.html` file directly in a browser.

## Regenerating

`generate_earthquake_maps.ps1` downloads fresh USGS GeoJSON snapshots (for archival)
and rewrites both HTML files, then copies everything to the OneDrive folder.

```powershell
.\generate_earthquake_maps.ps1
```
