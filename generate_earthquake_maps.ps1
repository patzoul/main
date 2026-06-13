<#
.SYNOPSIS
  Downloads fresh USGS earthquake data (world M2.5+ and Japan region, past 30 days)
  and (re)generates the two interactive Leaflet HTML maps, then copies everything
  to the OneDrive folder.

.USAGE
  Run from PowerShell:
    .\generate_earthquake_maps.ps1
#>

$OutDir    = "C:\Coding\Claude\earthquake_maps"
$OneDrive  = "C:\Users\pbess\OneDrive\Documents\Claude"

New-Item -ItemType Directory -Force -Path $OutDir    | Out-Null
New-Item -ItemType Directory -Force -Path $OneDrive  | Out-Null

# ---------------------------------------------------------------------------
# 1. Download fresh data snapshots via curl
# ---------------------------------------------------------------------------

Write-Host "Downloading world M2.5+ (past 30 days)..."
curl -L -o "$OutDir\world_earthquakes.geojson" `
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson"

$endDate   = Get-Date
$startDate = $endDate.AddDays(-30)
$startStr  = $startDate.ToString("yyyy-MM-dd")
$endStr    = $endDate.ToString("yyyy-MM-dd")

$japanUrl = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson" +
            "&starttime=$startStr&endtime=$endStr" +
            "&minmagnitude=2.5&minlatitude=23&maxlatitude=47&minlongitude=120&maxlongitude=150" +
            "&orderby=time&limit=20000"

Write-Host "Downloading Japan region M2.5+ ($startStr to $endStr)..."
curl -L -o "$OutDir\japan_earthquakes.geojson" $japanUrl

# ---------------------------------------------------------------------------
# 2. World map HTML
# ---------------------------------------------------------------------------

$worldHtml = @'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>World Earthquakes — Past Month</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #0d0d1a; }
    #map { width: 100vw; height: 100vh; }

    #panel {
      position: absolute; top: 14px; left: 14px; z-index: 1000;
      background: rgba(10, 10, 25, 0.90);
      border: 1px solid rgba(120, 160, 255, 0.25);
      border-radius: 10px; padding: 14px 18px; min-width: 230px;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    #panel h2 {
      font-size: 13px; font-weight: 700; letter-spacing: 1px;
      color: #7eb8f7; margin-bottom: 2px; text-transform: uppercase;
    }
    #panel .subtitle {
      font-size: 11px; color: #667; margin-bottom: 14px;
    }
    .ctrl-label {
      display: flex; justify-content: space-between;
      font-size: 11px; color: #aab; margin-bottom: 5px;
    }
    .ctrl-label .val { color: #7eb8f7; font-weight: 700; font-size: 13px; }
    input[type="range"] {
      width: 100%; accent-color: #7eb8f7; cursor: pointer;
      height: 4px; border-radius: 2px;
    }
    #stats {
      margin-top: 12px; padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 11px; color: #889;
    }
    #stats b { color: #7eb8f7; }
    #stats .timestamp { font-size: 10px; color: #556; margin-top: 4px; }

    #loading {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(10,10,25,0.88);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000; flex-direction: column; gap: 14px;
    }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(126,184,247,0.2);
      border-top-color: #7eb8f7;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loading p { color: #7eb8f7; font-size: 13px; letter-spacing: 0.5px; }
    #error-msg { color: #e74c3c; font-size: 12px; max-width: 280px; text-align: center; }

    .legend {
      position: absolute; bottom: 28px; right: 14px; z-index: 1000;
      background: rgba(10, 10, 25, 0.90);
      border: 1px solid rgba(120, 160, 255, 0.25);
      border-radius: 10px; padding: 12px 16px; min-width: 160px;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    .legend h4 {
      font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
      color: #7eb8f7; margin-bottom: 8px;
    }
    .leg-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
    .leg-dot {
      width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .leg-txt { font-size: 11px; color: #aab; }
    .leg-divider { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 9px 0; }
    .leg-size-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
    .leg-circle {
      border-radius: 50%; background: rgba(126,184,247,0.4);
      border: 1px solid rgba(126,184,247,0.7); flex-shrink: 0;
    }

    /* Leaflet tooltip override */
    .leaflet-tooltip {
      background: rgba(255,255,255,0.97) !important;
      border: none !important;
      border-radius: 8px !important;
      box-shadow: 0 3px 14px rgba(0,0,0,0.3) !important;
      padding: 0 !important;
    }
    .leaflet-tooltip-bottom::before { border-bottom-color: rgba(255,255,255,0.97) !important; }
    .tt {
      padding: 9px 12px; min-width: 190px;
    }
    .tt-place {
      font-size: 12px; font-weight: 700; color: #222;
      margin-bottom: 6px; line-height: 1.3;
    }
    .tt-grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
    .tt-key { font-size: 11px; color: #888; }
    .tt-val { font-size: 11px; font-weight: 600; color: #333; }
    .tt-val.red { color: #c0392b; }
  </style>
</head>
<body>

<div id="loading">
  <div class="spinner"></div>
  <p>Fetching USGS earthquake data…</p>
  <div id="error-msg"></div>
</div>

<div id="panel">
  <h2>World Earthquakes</h2>
  <div class="subtitle">USGS · Past 30 days · M 2.5+</div>
  <div class="ctrl-label">
    Min Magnitude &nbsp;<span class="val" id="magVal">M 2.5</span>
  </div>
  <input type="range" id="magSlider" min="2.5" max="7.0" step="0.1" value="2.5">
  <div id="stats">
    Showing <b id="vis">—</b> of <b id="tot">—</b> events
    <div class="timestamp" id="ts"></div>
  </div>
</div>

<div class="legend">
  <h4>Depth (km)</h4>
  <div class="leg-row"><div class="leg-dot" style="background:#e74c3c"></div><span class="leg-txt">Shallow  &lt; 70</span></div>
  <div class="leg-row"><div class="leg-dot" style="background:#f39c12"></div><span class="leg-txt">Intermediate 70–300</span></div>
  <div class="leg-row"><div class="leg-dot" style="background:#3498db"></div><span class="leg-txt">Deep  &gt; 300</span></div>
  <hr class="leg-divider">
  <h4>Magnitude (size)</h4>
  <div class="leg-size-row">
    <div class="leg-circle" style="width:6px;height:6px"></div>
    <span class="leg-txt">M 3</span>
  </div>
  <div class="leg-size-row">
    <div class="leg-circle" style="width:14px;height:14px"></div>
    <span class="leg-txt">M 5</span>
  </div>
  <div class="leg-size-row">
    <div class="leg-circle" style="width:22px;height:22px"></div>
    <span class="leg-txt">M 7</span>
  </div>
</div>

<div id="map"></div>

<script>
  const map = L.map('map', { preferCanvas: true, zoomControl: true })
               .setView([20, 10], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CartoDB</a> | Data: <a href="https://earthquake.usgs.gov/" style="color:#7eb8f7">USGS</a>',
    subdomains: 'abcd', maxZoom: 19
  }).addTo(map);

  function radius(mag) {
    return Math.max(3, Math.min(18, (mag - 1.5) * 2.2));
  }

  function depthColor(d) {
    if (d < 70)  return '#e74c3c';
    if (d < 300) return '#f39c12';
    return '#3498db';
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
  }

  function ttHtml(props, depth) {
    return `<div class="tt">
      <div class="tt-place">${props.place || 'Unknown location'}</div>
      <div class="tt-grid">
        <span class="tt-key">Magnitude</span><span class="tt-val red">M ${(props.mag||0).toFixed(1)}</span>
        <span class="tt-key">Depth</span><span class="tt-val">${(depth||0).toFixed(1)} km</span>
        <span class="tt-key">Time (UTC)</span><span class="tt-val">${fmtTime(props.time)}</span>
        <span class="tt-key">Type</span><span class="tt-val">${props.type || '—'}</span>
      </div>
    </div>`;
  }

  let allFeatures = [];
  let layerGroup = L.layerGroup().addTo(map);

  function renderMap(minMag) {
    layerGroup.clearLayers();
    const filtered = allFeatures
      .filter(f => (f.properties.mag || 0) >= minMag)
      .sort((a, b) => (a.properties.mag || 0) - (b.properties.mag || 0));

    filtered.forEach(f => {
      const [lon, lat, depth] = f.geometry.coordinates;
      const mag = f.properties.mag || 0;
      const d = depth || 0;

      const c = L.circleMarker([lat, lon], {
        radius: radius(mag),
        fillColor: depthColor(d),
        color: 'rgba(0,0,0,0.5)',
        weight: 0.5,
        fillOpacity: 0.78,
        opacity: 1
      });

      const html = ttHtml(f.properties, d);
      c.bindTooltip(html, { sticky: true, opacity: 1, className: '' });
      c.bindPopup(html + `<div style="padding:0 12px 9px;font-size:10px;color:#aaa">
        <a href="${f.properties.url}" target="_blank" style="color:#3498db">View on USGS ↗</a>
      </div>`);
      layerGroup.addLayer(c);
    });

    document.getElementById('vis').textContent = filtered.length.toLocaleString();
  }

  const DATA_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson';

  fetch(DATA_URL)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(data => {
      document.getElementById('loading').style.display = 'none';
      allFeatures = data.features;
      document.getElementById('tot').textContent = allFeatures.length.toLocaleString();
      const meta = data.metadata;
      if (meta && meta.generated) {
        document.getElementById('ts').textContent = 'Updated: ' + fmtTime(meta.generated);
      }
      renderMap(2.5);
    })
    .catch(err => {
      document.getElementById('loading').querySelector('p').textContent = 'Failed to load data';
      document.getElementById('error-msg').textContent = err.message + ' — check internet connection';
    });

  const slider = document.getElementById('magSlider');
  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    document.getElementById('magVal').textContent = 'M ' + v.toFixed(1);
    renderMap(v);
  });
</script>
</body>
</html>
'@

Set-Content -Path "$OutDir\world_earthquakes.html" -Value $worldHtml -Encoding UTF8 -NoNewline

# ---------------------------------------------------------------------------
# 3. Japan map HTML
# ---------------------------------------------------------------------------

$japanHtml = @'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Japan Earthquakes — Past Month</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #0d0d1a; }
    #map { width: 100vw; height: 100vh; }

    #panel {
      position: absolute; top: 14px; left: 14px; z-index: 1000;
      background: rgba(10, 10, 25, 0.90);
      border: 1px solid rgba(255, 160, 120, 0.30);
      border-radius: 10px; padding: 14px 18px; min-width: 230px;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    #panel h2 {
      font-size: 13px; font-weight: 700; letter-spacing: 1px;
      color: #f7a47e; margin-bottom: 2px; text-transform: uppercase;
    }
    #panel .subtitle {
      font-size: 11px; color: #667; margin-bottom: 14px;
    }
    .ctrl-label {
      display: flex; justify-content: space-between;
      font-size: 11px; color: #aab; margin-bottom: 5px;
    }
    .ctrl-label .val { color: #f7a47e; font-weight: 700; font-size: 13px; }
    input[type="range"] {
      width: 100%; accent-color: #f7a47e; cursor: pointer;
      height: 4px; border-radius: 2px;
    }
    #stats {
      margin-top: 12px; padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 11px; color: #889;
    }
    #stats b { color: #f7a47e; }
    #stats .timestamp { font-size: 10px; color: #556; margin-top: 4px; }

    #loading {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(10,10,25,0.88);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000; flex-direction: column; gap: 14px;
    }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(247,164,126,0.2);
      border-top-color: #f7a47e;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loading p { color: #f7a47e; font-size: 13px; letter-spacing: 0.5px; }
    #error-msg { color: #e74c3c; font-size: 12px; max-width: 280px; text-align: center; }

    .legend {
      position: absolute; bottom: 28px; right: 14px; z-index: 1000;
      background: rgba(10, 10, 25, 0.90);
      border: 1px solid rgba(255, 160, 120, 0.30);
      border-radius: 10px; padding: 12px 16px; min-width: 160px;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    .legend h4 {
      font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
      color: #f7a47e; margin-bottom: 8px;
    }
    .leg-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
    .leg-dot {
      width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .leg-txt { font-size: 11px; color: #aab; }
    .leg-divider { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 9px 0; }
    .leg-size-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
    .leg-circle {
      border-radius: 50%; background: rgba(247,164,126,0.4);
      border: 1px solid rgba(247,164,126,0.7); flex-shrink: 0;
    }

    .source-note {
      position: absolute; bottom: 8px; left: 14px; z-index: 1000;
      font-size: 10px; color: #445;
    }

    /* Leaflet tooltip override */
    .leaflet-tooltip {
      background: rgba(255,255,255,0.97) !important;
      border: none !important;
      border-radius: 8px !important;
      box-shadow: 0 3px 14px rgba(0,0,0,0.3) !important;
      padding: 0 !important;
    }
    .leaflet-tooltip-bottom::before { border-bottom-color: rgba(255,255,255,0.97) !important; }
    .tt { padding: 9px 12px; min-width: 200px; }
    .tt-place { font-size: 12px; font-weight: 700; color: #222; margin-bottom: 6px; line-height: 1.3; }
    .tt-grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
    .tt-key { font-size: 11px; color: #888; }
    .tt-val { font-size: 11px; font-weight: 600; color: #333; }
    .tt-val.red { color: #c0392b; }
  </style>
</head>
<body>

<div id="loading">
  <div class="spinner"></div>
  <p>Fetching Japan earthquake data…</p>
  <div id="error-msg"></div>
</div>

<div id="panel">
  <h2>Japan Earthquakes</h2>
  <div class="subtitle" id="subtitle">USGS · Past 30 days · M 2.5+</div>
  <div class="ctrl-label">
    Min Magnitude &nbsp;<span class="val" id="magVal">M 2.5</span>
  </div>
  <input type="range" id="magSlider" min="2.5" max="7.0" step="0.1" value="2.5">
  <div id="stats">
    Showing <b id="vis">—</b> of <b id="tot">—</b> events
    <div class="timestamp" id="ts"></div>
  </div>
</div>

<div class="legend">
  <h4>Depth (km)</h4>
  <div class="leg-row"><div class="leg-dot" style="background:#e74c3c"></div><span class="leg-txt">Shallow  &lt; 70</span></div>
  <div class="leg-row"><div class="leg-dot" style="background:#f39c12"></div><span class="leg-txt">Intermediate 70–300</span></div>
  <div class="leg-row"><div class="leg-dot" style="background:#3498db"></div><span class="leg-txt">Deep  &gt; 300</span></div>
  <hr class="leg-divider">
  <h4>Magnitude (size)</h4>
  <div class="leg-size-row">
    <div class="leg-circle" style="width:6px;height:6px"></div>
    <span class="leg-txt">M 3</span>
  </div>
  <div class="leg-size-row">
    <div class="leg-circle" style="width:14px;height:14px"></div>
    <span class="leg-txt">M 5</span>
  </div>
  <div class="leg-size-row">
    <div class="leg-circle" style="width:22px;height:22px"></div>
    <span class="leg-txt">M 7</span>
  </div>
</div>

<div id="map"></div>

<script>
  const map = L.map('map', { preferCanvas: true, zoomControl: true })
               .setView([36.5, 137], 5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CartoDB</a> | Data: <a href="https://earthquake.usgs.gov/" style="color:#f7a47e">USGS</a>',
    subdomains: 'abcd', maxZoom: 19
  }).addTo(map);

  function radius(mag) {
    return Math.max(3, Math.min(18, (mag - 1.5) * 2.2));
  }

  function depthColor(d) {
    if (d < 70)  return '#e74c3c';
    if (d < 300) return '#f39c12';
    return '#3498db';
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
  }

  function ttHtml(props, depth) {
    return `<div class="tt">
      <div class="tt-place">${props.place || 'Japan region'}</div>
      <div class="tt-grid">
        <span class="tt-key">Magnitude</span><span class="tt-val red">M ${(props.mag||0).toFixed(1)}</span>
        <span class="tt-key">Depth</span><span class="tt-val">${(depth||0).toFixed(1)} km</span>
        <span class="tt-key">Time (UTC)</span><span class="tt-val">${fmtTime(props.time)}</span>
        <span class="tt-key">Type</span><span class="tt-val">${props.type || '—'}</span>
      </div>
    </div>`;
  }

  let allFeatures = [];
  let layerGroup = L.layerGroup().addTo(map);

  function renderMap(minMag) {
    layerGroup.clearLayers();
    const filtered = allFeatures
      .filter(f => (f.properties.mag || 0) >= minMag)
      .sort((a, b) => (a.properties.mag || 0) - (b.properties.mag || 0));

    filtered.forEach(f => {
      const [lon, lat, depth] = f.geometry.coordinates;
      const mag = f.properties.mag || 0;
      const d = depth || 0;

      const c = L.circleMarker([lat, lon], {
        radius: radius(mag),
        fillColor: depthColor(d),
        color: 'rgba(0,0,0,0.5)',
        weight: 0.5,
        fillOpacity: 0.78,
        opacity: 1
      });

      const html = ttHtml(f.properties, d);
      c.bindTooltip(html, { sticky: true, opacity: 1, className: '' });
      c.bindPopup(html + `<div style="padding:0 12px 9px;font-size:10px;color:#aaa">
        <a href="${f.properties.url}" target="_blank" style="color:#3498db">View on USGS ↗</a>
      </div>`);
      layerGroup.addLayer(c);
    });

    document.getElementById('vis').textContent = filtered.length.toLocaleString();
  }

  // Build USGS query URL for Japan region (past 30 days, M2.5+)
  const endDate  = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmt = d => d.toISOString().split('T')[0];

  const DATA_URL = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
    `&starttime=${fmt(startDate)}&endtime=${fmt(endDate)}` +
    `&minmagnitude=2.5&minlatitude=23&maxlatitude=47&minlongitude=120&maxlongitude=150` +
    `&orderby=time&limit=20000`;

  document.getElementById('subtitle').textContent =
    `USGS · ${fmt(startDate)} → ${fmt(endDate)} · M 2.5+`;

  fetch(DATA_URL)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(data => {
      document.getElementById('loading').style.display = 'none';
      allFeatures = data.features;
      document.getElementById('tot').textContent = allFeatures.length.toLocaleString();
      document.getElementById('ts').textContent =
        'Retrieved: ' + new Date().toLocaleString();
      renderMap(2.5);
    })
    .catch(err => {
      document.getElementById('loading').querySelector('p').textContent = 'Failed to load data';
      document.getElementById('error-msg').textContent = err.message + ' — check internet connection';
    });

  const slider = document.getElementById('magSlider');
  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    document.getElementById('magVal').textContent = 'M ' + v.toFixed(1);
    renderMap(v);
  });
</script>
</body>
</html>
'@

Set-Content -Path "$OutDir\japan_earthquakes.html" -Value $japanHtml -Encoding UTF8 -NoNewline

# ---------------------------------------------------------------------------
# 4. Copy everything to OneDrive
# ---------------------------------------------------------------------------

Copy-Item "$OutDir\world_earthquakes.html"    "$OneDrive\world_earthquakes.html"    -Force
Copy-Item "$OutDir\japan_earthquakes.html"    "$OneDrive\japan_earthquakes.html"    -Force
Copy-Item "$OutDir\world_earthquakes.geojson" "$OneDrive\world_earthquakes.geojson" -Force
Copy-Item "$OutDir\japan_earthquakes.geojson" "$OneDrive\japan_earthquakes.geojson" -Force

Write-Host ""
Write-Host "Done! Maps regenerated in $OutDir and copied to $OneDrive"
