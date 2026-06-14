import json

with open("mapdata.json", encoding="utf-8") as f:
    data_str = f.read()

TEMPLATE = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>World Electricity Prices &amp; Generation Mix</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js" charset="utf-8"></script>
<style>
  :root{
    --bg:#0f141b; --panel:#161d27; --ink:#e8edf3; --muted:#9aa7b5;
    --line:#2a3542; --accent:#5dade2;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  header{padding:14px 20px 8px}
  h1{font-size:20px;margin:0;font-weight:650;letter-spacing:.2px}
  .sub{color:var(--muted);font-size:13px;margin-top:3px}
  #status{font-size:12px;color:var(--muted);margin-top:6px}
  #status .dot{display:inline-block;width:8px;height:8px;border-radius:50%;
    background:#888;margin-right:6px;vertical-align:middle}
  #status.live .dot{background:#36c275}
  #status.offline .dot{background:#e0a32e}
  #map{width:100%;height:calc(100vh - 150px);min-height:420px}
  footer{padding:6px 20px 14px;color:var(--muted);font-size:11.5px;line-height:1.5}
  footer a{color:var(--accent);text-decoration:none}
  /* custom hover tooltip */
  #tip{position:fixed;z-index:50;pointer-events:none;display:none;
    background:var(--panel);border:1px solid var(--line);border-radius:10px;
    padding:11px 13px;min-width:230px;max-width:300px;
    box-shadow:0 8px 28px rgba(0,0,0,.45);font-size:12.5px}
  #tip .tname{font-weight:650;font-size:14px;margin-bottom:2px}
  #tip .tprice{font-size:12.5px;color:var(--muted);margin-bottom:9px}
  #tip .tprice b{color:var(--ink);font-size:13.5px}
  #tip .tmix-h{font-size:11px;text-transform:uppercase;letter-spacing:.5px;
    color:var(--muted);margin:0 0 6px}
  #tip .row{display:flex;align-items:center;margin:3px 0;gap:7px}
  #tip .sw{width:9px;height:9px;border-radius:2px;flex:0 0 auto}
  #tip .lab{width:74px;flex:0 0 auto;color:var(--muted)}
  #tip .barwrap{flex:1;height:8px;background:#0d1219;border-radius:4px;overflow:hidden}
  #tip .bar{height:100%;border-radius:4px}
  #tip .pct{width:42px;text-align:right;flex:0 0 auto;font-variant-numeric:tabular-nums}
  #tip .nomix{color:var(--muted);font-style:italic}
  #overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
    background:rgba(15,20,27,.7);z-index:99;font-size:14px;color:var(--muted)}
  .spin{width:16px;height:16px;border:2px solid var(--line);border-top-color:var(--accent);
    border-radius:50%;display:inline-block;margin-right:10px;animation:sp .8s linear infinite;
    vertical-align:middle}
  @keyframes sp{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<header>
  <h1>Average Electricity Price by Country</h1>
  <div class="sub">Residential price (USD per kWh). Hover a country for its electricity generation mix. Countries in grey have no price data.</div>
  <div id="status"><span class="dot"></span><span id="status-text">Loading generation mix&hellip;</span></div>
</header>
<div id="map"></div>
<footer>
  <span id="foot-sources"></span>
</footer>
<div id="tip"></div>
<div id="overlay"><span class="spin"></span>Loading live generation-mix data&hellip;</div>

<script>
const RAW = __DATA__;

// ---- generation-source styling (label + colour) ----
const SOURCES = [
  ["coal","Coal","#5b6168"],
  ["gas","Gas","#e08a3c"],
  ["oil","Oil","#8c5a3c"],
  ["nuclear","Nuclear","#c0397f"],
  ["hydro","Hydro","#2f80c4"],
  ["wind","Wind","#3fc1c9"],
  ["solar","Solar","#f4c430"],
  ["bioenergy","Bioenergy","#5aa454"],
  ["other_renewables","Other renew.","#9fd27e"],
];

const PRICES = RAW.prices;            // iso3 -> {name, price}
let   MIX    = Object.assign({}, RAW.mix); // iso3 -> {name, year, <source>:pct,...}

// ---------- live refresh of generation mix ----------
const OWID_URL = "https://ourworldindata.org/grapher/share-elec-by-source.csv?v=1&csvType=full&useColumnShortNames=true";
const COLMAP = {
  coal:"coal_share_of_electricity__pct", gas:"gas_share_of_electricity__pct",
  oil:"oil_share_of_electricity__pct", nuclear:"nuclear_share_of_electricity__pct",
  hydro:"hydro_share_of_electricity__pct", wind:"wind_share_of_electricity__pct",
  solar:"solar_share_of_electricity__pct", bioenergy:"bioenergy_share_of_electricity__pct",
  other_renewables:"other_renewables_excluding_bioenergy_share_of_electricity__pct"
};

async function fetchLiveMix(){
  const res = await fetch(OWID_URL, {cache:"no-store"});
  if(!res.ok) throw new Error("HTTP "+res.status);
  const text = await res.text();
  const lines = text.trim().split("\n");
  const header = lines[0].split(",");
  const ix = {}; header.forEach((h,i)=>ix[h.trim()]=i);
  const fresh = {};
  for(let i=1;i<lines.length;i++){
    const c = lines[i].split(",");
    const iso = (c[ix["code"]]||"").trim();
    if(!/^[A-Za-z]{3}$/.test(iso)) continue;
    const year = parseInt(c[ix["year"]],10);
    if(!year) continue;
    if(fresh[iso] && fresh[iso].year >= year) continue;
    const e = {name:(c[ix["entity"]]||"").trim(), year:year};
    for(const k in COLMAP){
      const v = parseFloat(c[ix[COLMAP[k]]]);
      e[k] = isNaN(v) ? 0 : Math.round(v*100)/100;
    }
    fresh[iso] = e;
  }
  if(Object.keys(fresh).length < 50) throw new Error("unexpected data shape");
  return fresh;
}

function setStatus(kind, text){
  const el = document.getElementById("status");
  el.className = kind;
  document.getElementById("status-text").innerHTML = text;
}

// ---------- build & render map ----------
function colorscale(){
  return [[0.0,"#1a9850"],[0.25,"#a6d96a"],[0.5,"#fee08b"],
          [0.75,"#fdae61"],[1.0,"#d73027"]];
}

function renderMap(){
  const pricedIso = Object.keys(PRICES);
  const z = pricedIso.map(i => PRICES[i].price);
  const names = pricedIso.map(i => PRICES[i].name);
  const zmax = Math.max.apply(null, z);

  const priceTrace = {
    type:"choropleth", locationmode:"ISO-3",
    locations: pricedIso, z: z, customdata: names,
    zmin:0, zmax: zmax, colorscale: colorscale(),
    reversescale:false, hoverinfo:"none",
    marker:{line:{color:"#11161d", width:0.4}},
    colorbar:{
      title:{text:"USD / kWh", side:"right", font:{color:"#e8edf3",size:12}},
      tickfont:{color:"#cdd6e0",size:11}, thickness:14, len:0.72,
      outlinewidth:0, x:1.0, bgcolor:"rgba(0,0,0,0)",
      tickformat:"$.2f"
    }
  };

  // countries that have a generation mix but no price -> grey, still hoverable
  const greyIso = Object.keys(MIX).filter(i => !PRICES[i]);
  const greyTrace = {
    type:"choropleth", locationmode:"ISO-3",
    locations: greyIso, z: greyIso.map(()=>0),
    colorscale:[[0,"#3a4452"],[1,"#3a4452"]], showscale:false,
    hoverinfo:"none", marker:{line:{color:"#11161d", width:0.4}}
  };

  const layout = {
    margin:{l:0,r:0,t:0,b:0},
    paper_bgcolor:"rgba(0,0,0,0)", plot_bgcolor:"rgba(0,0,0,0)",
    geo:{
      projection:{type:"natural earth"},
      showframe:false, showcoastlines:false,
      showland:true, landcolor:"#222c38",
      showocean:true, oceancolor:"#0c1219",
      showcountries:true, countrycolor:"#11161d",
      lakecolor:"#0c1219", showlakes:true,
      bgcolor:"rgba(0,0,0,0)"
    }
  };

  Plotly.newPlot("map", [greyTrace, priceTrace], layout,
                 {responsive:true, displayModeBar:false}).then(attachHover);
}

// ---------- custom tooltip with mix bars ----------
function tipHtml(iso){
  const price = PRICES[iso];
  const mix = MIX[iso];
  const name = (price && price.name) || (mix && mix.name) || iso;
  let h = '<div class="tname">'+esc(name)+'</div>';
  if(price){
    h += '<div class="tprice">Residential price: <b>$'+price.price.toFixed(3)+'</b> / kWh</div>';
  }else{
    h += '<div class="tprice">Residential price: <b>no data</b></div>';
  }
  if(mix){
    h += '<div class="tmix-h">Electricity generation &middot; '+mix.year+'</div>';
    const rows = SOURCES.map(s => [s[1], s[2], mix[s[0]]||0])
                        .filter(r => r[2] > 0.05)
                        .sort((a,b)=>b[2]-a[2]);
    if(rows.length===0){ h += '<div class="nomix">No breakdown available</div>'; }
    rows.forEach(r=>{
      h += '<div class="row">'
         +   '<span class="sw" style="background:'+r[1]+'"></span>'
         +   '<span class="lab">'+r[0]+'</span>'
         +   '<span class="barwrap"><span class="bar" style="width:'
         +       Math.min(100,r[2]).toFixed(1)+'%;background:'+r[1]+'"></span></span>'
         +   '<span class="pct">'+r[2].toFixed(1)+'%</span>'
         + '</div>';
    });
  }else{
    h += '<div class="nomix">Generation mix unavailable</div>';
  }
  return h;
}
function esc(s){return String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}

function attachHover(){
  const tip = document.getElementById("tip");
  const gd = document.getElementById("map");
  gd.on("plotly_hover", function(d){
    const pt = d.points && d.points[0];
    if(!pt) return;
    tip.innerHTML = tipHtml(pt.location);
    tip.style.display = "block";
    moveTip(d.event);
  });
  gd.on("plotly_unhover", function(){ tip.style.display="none"; });
  gd.addEventListener("mousemove", function(e){
    if(tip.style.display==="block") moveTip(e);
  });
}
function moveTip(e){
  if(!e) return;
  const tip = document.getElementById("tip");
  const pad = 16, w = tip.offsetWidth, h = tip.offsetHeight;
  let x = e.clientX + pad, y = e.clientY + pad;
  if(x + w > window.innerWidth - 8)  x = e.clientX - w - pad;
  if(y + h > window.innerHeight - 8) y = e.clientY - h - pad;
  tip.style.left = x+"px"; tip.style.top = y+"px";
}

// ---------- footer ----------
document.getElementById("foot-sources").innerHTML =
  "Price data: "+esc(RAW.priceSource)+" (residential, "+esc(RAW.priceAsOf)+
  ", a periodic snapshot — no free worldwide live price feed exists). "+
  "Generation mix: "+esc(RAW.mixSource)+
  ", refreshed live from Our World in Data each time the map opens "+
  '(<a href="'+OWID_URL+'" target="_blank" rel="noopener">source CSV</a>).';

// ---------- init ----------
(async function init(){
  const overlay = document.getElementById("overlay");
  try{
    const fresh = await fetchLiveMix();
    MIX = fresh;
    const maxYear = Math.max.apply(null, Object.values(fresh).map(e=>e.year));
    setStatus("live", "Generation mix: <b>live</b> &middot; latest year "+maxYear+
                      " &middot; "+Object.keys(fresh).length+" countries");
  }catch(err){
    setStatus("offline", "Generation mix: offline snapshot (live refresh failed: "+
                         esc(err.message)+")");
  }finally{
    overlay.style.display = "none";
    renderMap();
  }
})();
</script>
</body>
</html>
'''

html = TEMPLATE.replace("__DATA__", data_str)
with open("electricity_map.html", "w", encoding="utf-8") as f:
    f.write(html)
print("wrote electricity_map.html", len(html), "bytes")
