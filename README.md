# Earthquake Map

Interactive Leaflet maps of recent earthquake activity, powered by live [USGS](https://earthquake.usgs.gov/) data.

## Maps

- **[world_earthquakes.html](world_earthquakes.html)** — global earthquakes, M2.5+, past 30 days
- **[japan_earthquakes.html](japan_earthquakes.html)** — Japan region (23–47°N, 120–150°E), M2.5+, past 30 days

Both maps:

- Fetch live data from the USGS earthquake API on load (requires internet)
- Size bubbles by magnitude, color by depth (shallow/intermediate/deep)
- Show a hover tooltip with location, magnitude, depth, time, and event type
- Include a minimum-magnitude slider to filter events

Open either `.html` file directly in a browser.

## Regenerating

`generate_earthquake_maps.ps1` downloads fresh USGS GeoJSON snapshots (for archival)
and rewrites both HTML files, then copies everything to the OneDrive folder.

```powershell
.\generate_earthquake_maps.ps1
```
