# Proposed Event Taxonomy

This is a proposed minimum event contract for validating the marketplace funnel. It is not a description of any existing Property Finder instrumentation.

| Event | Trigger | Required properties | Notes |
|---|---|---|---|
| `search_result_impression` | A listing card is actually rendered in the visible results viewport | `event_id`, `event_time`, `anonymous_id`, `session_id`, `market`, `search_id`, `listing_id`, `position`, `device`, `purpose` | Do not count a page response as an impression. Define visibility threshold and deduplicate repeated renders. |
| `listing_detail_view` | Listing detail page is rendered and visible | `event_id`, `event_time`, `anonymous_id`, `session_id`, `market`, `listing_id`, `source_search_id`, `device`, `purpose` | Preserve source context to connect discovery to detail. |
| `contact_cta_click` | Seeker selects call, message, WhatsApp or enquiry action | `event_id`, `event_time`, `anonymous_id`, `session_id`, `market`, `listing_id`, `contact_channel`, `cta_variant` | Separate intent action from successful lead creation. |
| `lead_submitted` | Enquiry is accepted by the backend | `lead_id`, `event_time`, `anonymous_id`, `market`, `listing_id`, `contact_channel`, `experiment_id`, `variant_id` | Deduplicate retries and cross-channel duplicates. |
| `lead_qualified` | Lead passes the agreed operational qualification definition | `lead_id`, `event_time`, `qualification_status`, `qualification_reason`, `market` | Define the qualification window and reason taxonomy with sales / broker operations. |
| `agent_first_response` | First meaningful agent response occurs | `lead_id`, `event_time`, `response_channel`, `agent_id`, `response_type` | Measure elapsed time from accepted lead; exclude automated receipts from meaningful response. |

## Funnel definitions

- **Search-to-view rate:** unique listing detail views attributed to search / eligible listing impressions.
- **View-to-lead rate:** unique accepted leads / eligible listing detail views.
- **Lead qualification rate:** qualified unique leads / accepted unique leads after the agreed qualification window.
- **First-response time:** time from accepted lead to first meaningful agent response. Report distribution percentiles, not only an average.

## Instrumentation checks before an experiment

1. Confirm event ordering, timezone handling, identity stitching and duplicate rules.
2. Validate that the treatment assignment is persisted at seeker level and exposed to analysis.
3. Ensure call, WhatsApp and form leads are joined to the same lead definition where possible.
4. Monitor missing `listing_id`, missing market, bot traffic and instrumentation loss by variant.
5. Lock a qualification window before reading results to avoid right-censoring.
