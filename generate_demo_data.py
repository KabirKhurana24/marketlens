"""Generate deterministic synthetic demo data for MarketLens.

All values are fictional and intended only for a portfolio prototype.
"""
from __future__ import annotations
import csv, json, math, random
from pathlib import Path
from datetime import date, timedelta

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)
random.seed(24)

markets = [
    {"market":"Dubai","code":"DXB","currency":"AED","impressions":420000,"views":126000,"leads":13860,"qualified":8316,"active_listings":32400,"response_min":12.4,"quality_score":82,"verified_pct":88,"stale_pct":8,"lead_rate":0.110,"qualified_rate":0.60,"ctr":0.30,"trend":0.0035},
    {"market":"Cairo","code":"CAI","currency":"EGP","impressions":310000,"views":68200,"leads":5456,"qualified":2182,"active_listings":27800,"response_min":38.0,"quality_score":68,"verified_pct":63,"stale_pct":16,"lead_rate":0.080,"qualified_rate":0.40,"ctr":0.22,"trend":0.0010},
    {"market":"Riyadh","code":"RUH","currency":"SAR","impressions":275000,"views":82500,"leads":6600,"qualified":4290,"active_listings":19500,"response_min":19.0,"quality_score":74,"verified_pct":77,"stale_pct":11,"lead_rate":0.080,"qualified_rate":0.65,"ctr":0.30,"trend":0.0060},
    {"market":"Abu Dhabi","code":"AUH","currency":"AED","impressions":150000,"views":45000,"leads":5400,"qualified":3456,"active_listings":11200,"response_min":14.0,"quality_score":85,"verified_pct":91,"stale_pct":6,"lead_rate":0.120,"qualified_rate":0.64,"ctr":0.30,"trend":0.0025},
    {"market":"Doha","code":"DOH","currency":"QAR","impressions":120000,"views":33600,"leads":3360,"qualified":2016,"active_listings":8400,"response_min":17.0,"quality_score":79,"verified_pct":82,"stale_pct":9,"lead_rate":0.100,"qualified_rate":0.60,"ctr":0.28,"trend":0.0020},
]

# Twelve completed weeks ending 9 November 2026.
start = date(2026, 8, 17)
weekly = []
for wi in range(12):
    week_start = start + timedelta(days=7*wi)
    week_end = week_start + timedelta(days=6)
    seasonal = 1 + 0.025 * math.sin(wi * 0.9)
    for m in markets:
        noise = random.uniform(-0.035, 0.035)
        scale = seasonal * (1 + m["trend"] * wi) * (1 + noise)
        impressions = round(m["impressions"] / 4.345 * scale)
        views = round(impressions * m["ctr"] * (1 + random.uniform(-0.012, 0.012)))
        # Keep market-specific conversion behaviour, with small weekly variation.
        lead_rate = m["lead_rate"] * (1 + 0.015 * math.sin(wi * 0.7 + len(m["code"])))
        leads = round(views * lead_rate)
        qualified_rate = m["qualified_rate"] * (1 + 0.012 * math.cos(wi * 0.65 + len(m["market"])))
        qualified = round(leads * qualified_rate)
        response = round(m["response_min"] * (1 + random.uniform(-0.07, 0.07)), 1)
        weekly.append({
            "week_start": week_start.isoformat(), "week_end": week_end.isoformat(),
            "market": m["market"], "impressions": impressions, "listing_views": views,
            "leads": leads, "qualified_leads": qualified,
            "active_listings": m["active_listings"], "median_response_min": response
        })

with (DATA / "market_weekly.csv").open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(weekly[0].keys()))
    writer.writeheader(); writer.writerows(weekly)

listings = [
    {"id":"DXB-1842","market":"Dubai","title":"2BR apartment · Dubai Marina","purpose":"Buy","price":2450000,"currency":"AED","beds":2,"area_sqft":1280,"photos":12,"verified":True,"completeness":98,"days_live":5,"price_deviation_pct":2,"leads_30d":46,"qualified_30d":31,"issue":"Healthy","owner":"Agency partner"},
    {"id":"DXB-2290","market":"Dubai","title":"1BR apartment · Jumeirah Village Circle","purpose":"Rent","price":77000,"currency":"AED / yr","beds":1,"area_sqft":760,"photos":3,"verified":False,"completeness":64,"days_live":42,"price_deviation_pct":9,"leads_30d":8,"qualified_30d":3,"issue":"Stale · low media · unverified","owner":"Individual agent"},
    {"id":"DXB-3118","market":"Dubai","title":"3BR townhouse · Arabian Ranches","purpose":"Buy","price":3100000,"currency":"AED","beds":3,"area_sqft":2140,"photos":9,"verified":True,"completeness":91,"days_live":17,"price_deviation_pct":4,"leads_30d":28,"qualified_30d":19,"issue":"Healthy","owner":"Agency partner"},
    {"id":"DXB-3751","market":"Dubai","title":"Studio · Business Bay","purpose":"Rent","price":68000,"currency":"AED / yr","beds":0,"area_sqft":510,"photos":4,"verified":True,"completeness":78,"days_live":35,"price_deviation_pct":16,"leads_30d":11,"qualified_30d":4,"issue":"Price mismatch · ageing","owner":"Agency partner"},
    {"id":"CAI-0811","market":"Cairo","title":"3BR apartment · New Cairo","purpose":"Buy","price":6800000,"currency":"EGP","beds":3,"area_sqft":1780,"photos":2,"verified":False,"completeness":52,"days_live":51,"price_deviation_pct":21,"leads_30d":5,"qualified_30d":1,"issue":"Unverified · incomplete · low media","owner":"Individual agent"},
    {"id":"CAI-0954","market":"Cairo","title":"2BR apartment · Maadi","purpose":"Rent","price":38000,"currency":"EGP / mo","beds":2,"area_sqft":1120,"photos":5,"verified":True,"completeness":73,"days_live":29,"price_deviation_pct":7,"leads_30d":14,"qualified_30d":5,"issue":"Ageing · incomplete","owner":"Agency partner"},
    {"id":"CAI-1207","market":"Cairo","title":"Villa · Sheikh Zayed","purpose":"Buy","price":14500000,"currency":"EGP","beds":4,"area_sqft":2950,"photos":10,"verified":True,"completeness":94,"days_live":8,"price_deviation_pct":3,"leads_30d":22,"qualified_30d":10,"issue":"Healthy","owner":"Agency partner"},
    {"id":"RUH-4301","market":"Riyadh","title":"Villa · Al Narjis","purpose":"Buy","price":2200000,"currency":"SAR","beds":5,"area_sqft":3200,"photos":3,"verified":True,"completeness":79,"days_live":22,"price_deviation_pct":18,"leads_30d":18,"qualified_30d":12,"issue":"Price mismatch · low media","owner":"Agency partner"},
    {"id":"RUH-4415","market":"Riyadh","title":"2BR apartment · Al Yasmin","purpose":"Rent","price":72000,"currency":"SAR / yr","beds":2,"area_sqft":1180,"photos":11,"verified":True,"completeness":93,"days_live":7,"price_deviation_pct":2,"leads_30d":31,"qualified_30d":22,"issue":"Healthy","owner":"Agency partner"},
    {"id":"RUH-4582","market":"Riyadh","title":"1BR apartment · Al Malqa","purpose":"Rent","price":61000,"currency":"SAR / yr","beds":1,"area_sqft":850,"photos":4,"verified":False,"completeness":67,"days_live":38,"price_deviation_pct":11,"leads_30d":9,"qualified_30d":4,"issue":"Unverified · ageing","owner":"Individual agent"},
    {"id":"AUH-2104","market":"Abu Dhabi","title":"Studio · Al Reem Island","purpose":"Buy","price":720000,"currency":"AED","beds":0,"area_sqft":560,"photos":14,"verified":True,"completeness":99,"days_live":4,"price_deviation_pct":1,"leads_30d":37,"qualified_30d":25,"issue":"Healthy","owner":"Agency partner"},
    {"id":"AUH-2262","market":"Abu Dhabi","title":"2BR apartment · Yas Island","purpose":"Rent","price":104000,"currency":"AED / yr","beds":2,"area_sqft":1340,"photos":8,"verified":True,"completeness":88,"days_live":13,"price_deviation_pct":5,"leads_30d":24,"qualified_30d":16,"issue":"Healthy","owner":"Agency partner"},
    {"id":"DOH-1133","market":"Doha","title":"2BR apartment · The Pearl","purpose":"Buy","price":2100000,"currency":"QAR","beds":2,"area_sqft":1460,"photos":7,"verified":True,"completeness":86,"days_live":16,"price_deviation_pct":6,"leads_30d":19,"qualified_30d":12,"issue":"Healthy","owner":"Agency partner"},
    {"id":"DOH-1288","market":"Doha","title":"3BR townhouse · Lusail","purpose":"Rent","price":96000,"currency":"QAR / yr","beds":3,"area_sqft":1900,"photos":3,"verified":False,"completeness":61,"days_live":47,"price_deviation_pct":14,"leads_30d":6,"qualified_30d":2,"issue":"Stale · low media · unverified","owner":"Individual agent"},
    {"id":"DOH-1390","market":"Doha","title":"1BR apartment · West Bay","purpose":"Rent","price":78000,"currency":"QAR / yr","beds":1,"area_sqft":890,"photos":9,"verified":True,"completeness":90,"days_live":11,"price_deviation_pct":3,"leads_30d":26,"qualified_30d":17,"issue":"Healthy","owner":"Agency partner"},
]

def quality_score(x):
    photo = min(x["photos"] / 10, 1) * 20
    verification = 20 if x["verified"] else 0
    freshness = max(0, 1 - x["days_live"] / 60) * 15
    price_fit = max(0, 1 - abs(x["price_deviation_pct"]) / 30) * 15
    return round(x["completeness"] * .30 + photo + verification + freshness + price_fit)

for x in listings:
    x["quality_score"] = quality_score(x)

with (DATA / "listing_health.csv").open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(listings[0].keys()))
    writer.writeheader(); writer.writerows(listings)

profiles = [{k:v for k,v in m.items() if k not in {"impressions","views","leads","qualified","lead_rate","qualified_rate","ctr","trend"}} for m in markets]
with (DATA / "markets.json").open("w", encoding="utf-8") as f:
    json.dump({"generated_at":"2026-11-12","data_note":"Synthetic portfolio demo data. Not Property Finder data.","markets":profiles,"weekly":weekly,"listings":listings}, f, indent=2)
print(f"Generated {len(weekly)} weekly market rows and {len(listings)} listings")
