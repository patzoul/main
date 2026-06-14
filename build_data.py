import csv, re, json, sys, os, urllib.request

# ---------- 0. Download source data if not already present ----------
OWID_URL = ("https://ourworldindata.org/grapher/share-elec-by-source.csv"
            "?v=1&csvType=full&useColumnShortNames=true")
GPP_URL = "https://www.globalpetrolprices.com/electricity_prices/"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

def download(url, path):
    if os.path.exists(path):
        print(f"using cached {path}")
        return
    print(f"downloading {path} ...")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        open(path, "wb").write(r.read())

download(OWID_URL, "owid_mix.csv")
download(GPP_URL, "gpp.html")

# ---------- 1. Parse OWID generation mix (latest year per ISO3) ----------
SRC_COLS = {
    "coal_share_of_electricity__pct": "coal",
    "gas_share_of_electricity__pct": "gas",
    "oil_share_of_electricity__pct": "oil",
    "nuclear_share_of_electricity__pct": "nuclear",
    "hydro_share_of_electricity__pct": "hydro",
    "wind_share_of_electricity__pct": "wind",
    "solar_share_of_electricity__pct": "solar",
    "bioenergy_share_of_electricity__pct": "bioenergy",
    "other_renewables_excluding_bioenergy_share_of_electricity__pct": "other_renewables",
}

mix = {}          # iso3 -> {name, year, coal, gas, ...}
name_to_iso = {}  # lower(entity) -> iso3   (OWID's own mapping)

with open("owid_mix.csv", encoding="utf-8") as f:
    r = csv.DictReader(f)
    for row in r:
        iso = (row.get("code") or "").strip()
        if len(iso) != 3 or not iso.isalpha():
            continue  # skip aggregates / regions (no ISO3)
        try:
            year = int(row["year"])
        except ValueError:
            continue
        name = row["entity"].strip()
        name_to_iso.setdefault(name.lower(), iso)
        prev = mix.get(iso)
        if prev and prev["year"] >= year:
            continue
        entry = {"name": name, "year": year}
        for col, key in SRC_COLS.items():
            v = row.get(col, "")
            try:
                entry[key] = round(float(v), 2)
            except (ValueError, TypeError):
                entry[key] = 0.0
        mix[iso] = entry

# ---------- 2. Parse GlobalPetrolPrices residential prices ----------
html = open("gpp.html", encoding="utf-8").read()
pat = re.compile(
    r'<a href="/[^"]*?/electricity_prices/"[^>]*>([^<]+)</a></td>\s*<td>([^<]*)</td>',
    re.S,
)
raw_prices = []
for m in pat.finditer(html):
    nm = m.group(1).strip()
    val = m.group(2).strip()
    try:
        raw_prices.append((nm, float(val)))
    except ValueError:
        pass

# ---------- 3. Aliases: GPP display name -> ISO3 ----------
ALIAS = {
    "uk": "GBR", "usa": "USA", "united states": "USA",
    "south korea": "KOR", "north korea": "PRK", "russia": "RUS",
    "iran": "IRN", "syria": "SYR", "laos": "LAO", "vietnam": "VNM",
    "moldova": "MDA", "tanzania": "TZA", "venezuela": "VEN",
    "bolivia": "BOL", "brunei": "BRN", "ivory coast": "CIV",
    "cote d'ivoire": "CIV", "democratic republic of congo": "COD",
    "dr congo": "COD", "congo": "COG", "czech republic": "CZE",
    "slovakia": "SVK", "macedonia": "MKD", "north macedonia": "MKD",
    "cape verde": "CPV", "swaziland": "SWZ", "eswatini": "SWZ",
    "the gambia": "GMB", "gambia": "GMB", "kosovo": "XKX",
    "myanmar": "MMR", "burma": "MMR", "palestine": "PSE",
    "taiwan": "TWN", "hong kong": "HKG", "macau": "MAC", "macao": "MAC",
    "cayman islands": "CYM", "bermuda": "BMU", "puerto rico": "PRI",
    "aruba": "ABW", "curacao": "CUW", "u.s. virgin islands": "VIR",
    "british virgin islands": "VGB", "new caledonia": "NCL",
    "french polynesia": "PYF", "guam": "GUM", "gibraltar": "GIB",
    "isle of man": "IMN", "liechtenstein": "LIE", "monaco": "MCO",
    "san marino": "SMR", "andorra": "AND", "faroe islands": "FRO",
    "greenland": "GRL", "seychelles": "SYC", "mauritius": "MUS",
    "maldives": "MDV", "fiji": "FJI", "samoa": "WSM", "tonga": "TON",
    "vanuatu": "VUT", "solomon islands": "SLB", "papua new guinea": "PNG",
    "east timor": "TLS", "timor-leste": "TLS", "bahamas": "BHS",
    "the bahamas": "BHS", "trinidad and tobago": "TTO",
    "antigua and barbuda": "ATG", "st lucia": "LCA", "saint lucia": "LCA",
    "st kitts and nevis": "KNA", "grenada": "GRD", "dominica": "DMA",
    "st vincent and the grenadines": "VCT", "barbados": "BRB",
    "belize": "BLZ", "guyana": "GUY", "suriname": "SUR",
    "bosnia and herzegovina": "BIH", "bosnia-herzegovina": "BIH",
    "montenegro": "MNE", "serbia": "SRB", "south sudan": "SSD",
    "central african republic": "CAF", "equatorial guinea": "GNQ",
    "guinea-bissau": "GNB", "sierra leone": "SLE", "burkina faso": "BFA",
    "djibouti": "DJI", "comoros": "COM", "sao tome and principe": "STP",
    "uae": "ARE", "united arab emirates": "ARE", "saudi arabia": "SAU",
    "qatar": "QAT", "bahrain": "BHR", "kuwait": "KWT", "oman": "OMN",
    "yemen": "YEM", "lebanon": "LBN", "jordan": "JOR", "iraq": "IRQ",
    "afghanistan": "AFG", "pakistan": "PAK", "bangladesh": "BGD",
    "sri lanka": "LKA", "nepal": "NPL", "bhutan": "BTN",
    "cambodia": "KHM", "mongolia": "MNG", "kazakhstan": "KAZ",
    "uzbekistan": "UZB", "turkmenistan": "TKM", "kyrgyzstan": "KGZ",
    "tajikistan": "TJK", "azerbaijan": "AZE", "armenia": "ARM",
    "georgia": "GEO", "belarus": "BLR", "ukraine": "UKR",
    "turkey": "TUR", "egypt": "EGY", "morocco": "MAR", "algeria": "DZA",
    "tunisia": "TUN", "libya": "LBY", "sudan": "SDN", "ethiopia": "ETH",
    "kenya": "KEN", "uganda": "UGA", "rwanda": "RWA", "burundi": "BDI",
    "nigeria": "NGA", "ghana": "GHA", "senegal": "SEN", "mali": "MLI",
    "niger": "NER", "chad": "TCD", "cameroon": "CMR", "gabon": "GAB",
    "angola": "AGO", "zambia": "ZMB", "zimbabwe": "ZWE",
    "mozambique": "MOZ", "malawi": "MWI", "madagascar": "MDG",
    "botswana": "BWA", "namibia": "NAM", "lesotho": "LSO",
    "south africa": "ZAF", "togo": "TGO", "benin": "BEN",
    "liberia": "LBR", "mauritania": "MRT", "guinea": "GIN",
    "costa rica": "CRI", "panama": "PAN", "nicaragua": "NIC",
    "honduras": "HND", "guatemala": "GTM", "el salvador": "SLV",
    "dominican republic": "DOM", "haiti": "HTI", "jamaica": "JAM",
    "cuba": "CUB", "ecuador": "ECU", "peru": "PER", "colombia": "COL",
    "paraguay": "PRY", "uruguay": "URY", "chile": "CHL",
    "argentina": "ARG", "brazil": "BRA", "mexico": "MEX",
    "new zealand": "NZL", "philippines": "PHL", "indonesia": "IDN",
    "malaysia": "MYS", "singapore": "SGP", "thailand": "THA",
    "china": "CHN", "japan": "JPN", "india": "IND",
    "n. maced.": "MKD", "dom. rep.": "DOM",
    "bosnia & herz.": "BIH", "trinidad & tobago": "TTO",
}

def resolve(name):
    key = name.lower().strip()
    if key in ALIAS:
        return ALIAS[key]
    if key in name_to_iso:
        return name_to_iso[key]
    return None

prices = {}
unmatched = []
for nm, val in raw_prices:
    iso = resolve(nm)
    if iso:
        prices[iso] = {"name": nm, "price": round(val, 4)}
    else:
        unmatched.append(nm)

# ---------- 4. Report + write ----------
print(f"OWID mix countries: {len(mix)}  (latest year sample: USA={mix.get('USA',{}).get('year')})")
print(f"GPP price rows parsed: {len(raw_prices)}  matched: {len(prices)}")
if unmatched:
    print("UNMATCHED price countries:", unmatched)

out = {
    "priceAsOf": "2023-2026 average",
    "priceSource": "GlobalPetrolPrices.com",
    "mixSource": "Our World in Data / Ember & Energy Institute",
    "mixSourceYearMax": max((e["year"] for e in mix.values()), default=None),
    "prices": prices,
    "mix": mix,
}
with open("mapdata.json", "w", encoding="utf-8") as f:
    json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
print("wrote mapdata.json", f"prices={len(prices)} mix={len(mix)}")
