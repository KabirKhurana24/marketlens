# MarketLens — Turning Property Marketplace Signals Into Product Bets

**Independent product case study · Synthetic demo data · November 2026**

## The problem I chose

A property marketplace can increase enquiry volume and still fail to improve the experience. A submitted lead may be unqualified, a listing may be stale or incomplete, and an agent may respond too late. Looking at one blended conversion number hides where the system is actually breaking.

## The product

MarketLens is a lightweight product decision workspace for a multi-market property marketplace. It connects four views:

1. **Demand funnel:** search impressions → listing views → submitted leads → qualified leads.
2. **Market differences:** compare conversion, lead quality, supply health and response-time proxies across Dubai, Cairo, Riyadh, Abu Dhabi and Doha.
3. **Listing health:** surface stale, incomplete, unverified, low-media or price-misaligned inventory with an explainable score.
4. **Experiment lab:** define a contact-flow A/B test and model the potential incremental qualified leads under explicit assumptions.

## What the demo data reveals

The synthetic 30-day view creates three different product hypotheses:

- **Cairo:** around 8.0% of listing views become leads, around 40% of leads qualify, and the response-time proxy is around 37 minutes. I would investigate lead routing and agent response before increasing acquisition.
- **Riyadh:** search discovery is comparatively strong, but only around 8.0% of listing views become leads. I would inspect price context and the listing-detail contact journey.
- **Dubai:** 8% of 32,400 active listings are marked stale in the demo profile. Even a modest stale share can represent a large absolute inventory count, so I would prioritise by traffic and exposure.

The numbers are fictional and exist to make the prototype interactive. They are not Property Finder metrics or market benchmarks.

## One experiment I would run

**Hypothesis:** If we make the contact action clearer and reduce avoidable form friction, more high-intent listing viewers will become qualified leads.

- **Control:** current listing detail contact flow.
- **Treatment:** prominent call / message choice, fewer required fields and context pre-filled from the listing.
- **Primary metric:** qualified leads per 1,000 listing views.
- **Guardrails:** unqualified-lead rate, spam rate and agent response SLA.
- **Rollout:** seeker-level 50/50 split, validate event quality and power first, then evaluate by market rather than assuming the result transfers.

The simulator estimates scenario impact only. It does not claim a causal lift or forecast.

## What I deliberately kept honest

The dataset is weekly aggregate data and the listing sample contains 15 fictional records. That is enough to demonstrate the product workflow, but not enough to locate a precise funnel drop-off or prove why it happens. I did not add a revenue estimate because monetisation and broker economics are not defined. The insight cards are rule-based and inspectable; no live AI model or company system is connected.

## What I would do with real data

Validate the event taxonomy, pull market × device × purpose × source cohorts, join listing attributes to seeker behaviour, interview agents about lead handling, and run a powered market-specific experiment. I would only ship if qualified leads per 1,000 views improve without guardrail regression.

## What this project demonstrates

Product decomposition · Building a working prototype · Funnel arithmetic · Synthetic data modelling · Multi-market segmentation · Explainable scoring · Experiment design · Clear assumptions and limitations

**Demo:** deploy the `marketlens` folder as a static site and insert the public URL here: `[add deployed demo URL]`.


## Access and demo

The prototype opens with a dedicated sign-in screen and an instant Explore Demo path. Local account creation and sign-in are wired to the included Node server, with hashed passwords and HTTP-only session cookies. This is a local portfolio implementation, not production identity infrastructure; public deployments should use a managed auth provider. All marketplace analytics remain synthetic.
