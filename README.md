# MarketLens — Real Estate Product Lab

**An independent portfolio prototype for a multi-market property marketplace.**

MarketLens explores a simple product question: *how do we grow useful property enquiries, not just raw lead volume?* It brings together demand-funnel performance, listing trust signals and lead-fulfilment proxies across five illustrative MENA markets.

> **Important:** All data is synthetic and generated for this case study. This is not Property Finder data, is not affiliated with Property Finder, and is not connected to any live service.

## Run locally

The app is a static HTML/CSS/JavaScript prototype with no build step and no external runtime dependencies. It loads `data/markets.json`, so serve the folder over HTTP rather than opening `index.html` directly.

**Windows, macOS or Linux (Node.js required):**

```bash
cd marketlens
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173). No `npm install` is required; the local server uses Node.js built-in modules only. Use `Ctrl+C` to stop it.

You can also run `npm start` to launch the same server.

## Access, sign-in and demo mode

The first screen includes a sign-in flow, account creation, password visibility control, sign-out and an instant **Explore the live demo** path. The demo button opens the workspace without requiring an account. The local Node server supports account registration and sign-in using password hashes (scrypt), HTTP-only session cookies and a local user store kept outside the project directory.

**Local authentication is a portfolio-prototype implementation, not production identity infrastructure.** It has no email verification, password-reset delivery, rate limiting, multi-factor authentication or managed database. Sessions are held in server memory and are cleared when the local server restarts. For a public production deployment, connect a managed identity provider (for example, Supabase Auth or Clerk) and configure its keys and redirect URLs. A static deployment can still be explored using the demo button; account sign-in requires the Node server.

## What is in the product

| Area | What it demonstrates |
|---|---|
| Overview | Search → listing view → lead → qualified lead funnel, weekly trend, market comparison and product signals |
| Market breakdown | Side-by-side conversion and lead-quality comparison across Dubai, Cairo, Riyadh, Abu Dhabi and Doha |
| Listing health | Searchable inventory audit with an explainable quality score and a local review-queue action |
| Experiment lab | A/B test hypothesis, control/treatment definition, primary and guardrail metrics, and an impact simulator |

## Product decisions

1. **Optimise downstream outcomes.** A form submission is not the same as a useful lead, so qualified leads are visible throughout the experience.
2. **Localise the diagnosis.** The demo data intentionally creates different patterns: Cairo has weaker lead qualification and slower response; Riyadh has strong search discovery but weaker detail-to-lead conversion; Dubai has a small stale share across a large inventory base.
3. **Make supply quality actionable.** Listing health is not just a score. The queue surfaces specific issues such as stale inventory, missing media, incomplete attributes, unverified status and price deviation.
4. **Prototype the decision.** The experiment page makes assumptions explicit and estimates a scenario, rather than presenting a lift as a forecast.
5. **Keep the analysis auditable.** The insight cards use transparent rules in this demo. No LLM is connected and no model-generated claim is passed off as live intelligence.

## Demo data

- `data/markets.json` — app-ready data bundle.
- `data/market_weekly.csv` — 60 weekly market rows (12 weeks × 5 markets).
- `data/listing_health.csv` — 15 fictional sample listings.
- `generate_demo_data.py` — deterministic generator (seeded) for recreating the sample dataset.

The demo window contains 12 completed weeks ending 8 November 2026. The default view is the most recent 30 days. Example patterns in the 30-day window:

- Cairo: approximately **8.0%** listing-view-to-lead conversion and **40.1%** lead qualification; the response-time proxy is around **37 minutes**.
- Riyadh: approximately **30%** search-impression-to-listing-view discovery, while about **8.0%** of listing views become leads.
- Dubai: **8%** of 32,400 active listings are marked stale in the synthetic profile — roughly 2,600 records, illustrating why absolute volume matters as well as percentage.

These are deliberately constructed values, not market facts or company performance.

## Quality-score logic

The listing score is intentionally simple and explainable:

- 30% listing completeness
- 20% photo coverage (capped at 10 photos)
- 20% verification status
- 15% freshness (days live, capped at 60)
- 15% price fit (absolute deviation, capped at 30%)

Thresholds: **80–100 Healthy**, **60–79 Watch**, **below 60 At risk**. This is a demo heuristic, not a validated ranking system. A production score should be calibrated against seeker behaviour and operational outcomes, with separate treatment for property type, purpose and market.

## Experiment logic

The proposed test reduces contact-flow friction on listing detail pages. The simulator assumes a relative lift in listing-view-to-lead conversion while holding traffic and lead qualification constant:

`incremental qualified leads = monthly listing views × baseline view-to-lead rate × relative lift × baseline qualification rate`

It is a scenario calculator only. A real launch would require event validation, eligibility rules, sample-size / minimum-detectable-effect analysis, seeker-level randomisation, guardrail monitoring and a market-by-market rollout decision.

## Known limitations — intentionally visible

- The demo has weekly aggregates, not event-level journeys. It cannot locate a precise UI drop-off or prove causality.
- Only 15 listing records are included in the health queue; this is a teaching sample, not representative supply coverage.
- Lead qualification and response time are proxies. Real definitions must be aligned with sales / broker operations and deduplicated across call, WhatsApp and form channels.
- The experiment simulator does not estimate confidence intervals, revenue, broker value or statistical power.
- The local prototype includes lightweight account registration and sign-in, but it is not production-grade identity infrastructure.
- There is no production data connection or live AI integration.

## Suggested next iteration with real access

1. Validate the event taxonomy in `docs/event_taxonomy.md` and reconcile impression, view, lead and qualified-lead definitions.
2. Pull a market × device × purpose × source cohort and inspect the funnel with sample sizes and confidence intervals.
3. Join listing attributes and freshness to seeker behaviour; test whether quality signals predict qualified leads after controlling for price band and market.
4. Interview brokers / agents to validate the response-time bottleneck and understand channel-level lead handling.
5. Run a powered experiment in one market, then check treatment heterogeneity before expanding.

## Suggested deployment

The browser experience is static and can be deployed to Vercel, Netlify or GitHub Pages with no build command and the project root as the output directory. On a static host, use the Explore Demo button; account creation and sign-in are available when running the included Node server locally. For hosted account access, first connect a managed identity provider and persistent user store. Keep the synthetic-data disclosure visible in any public demo.

## Portfolio positioning

This project is intended to show product decomposition, hands-on prototyping, data reasoning, multi-market thinking and experiment design. It has **not** been used by external users. Do not claim user adoption or business impact; use the limitations above as part of the discussion.
