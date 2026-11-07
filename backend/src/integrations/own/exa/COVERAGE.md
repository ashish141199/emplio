# Exa coverage

Source: Exa's OpenAPI specs (github.com/exa-labs/openapi-spec: exa-openapi-spec.yaml and exa-websets-spec.yaml),
generated 2026-10-26 by `bun scripts/openapi-actions.ts exa`. Every operation in both is an action (45), plus the
four hand-written ones `emplio web` shares (search, get_contents, find_similar, answer: friendlier inputs).

## Deliberately left out

| What | Why |
| --- | --- |
| Nothing in the specs | — |
| Team management (API keys) | Not in Exa's public specs |
| Events (triggers) | Own apps have no triggers yet. Websets have webhooks (create_webhook / delete_webhook are actions), so webset.item.created and friends come first when they do |

## Hand adjustments (scripts/openapi/exa.ts, own/exa/index.ts)

- The spec's search/findSimilar/contents/answer are `*_advanced`: every option, Exa's own field names (numResults…).
- Websets calls go to api.exa.ai/websets; the key goes in `x-api-key` (websets take nothing else).
- Lookups that are POSTs run without asking: the four `*_advanced`, preview_webset.

## Auth

| Method | Status |
| --- | --- |
| API key (dashboard.exa.ai/api-keys), sent as x-api-key | done |

## Actions by group (* asks first)

**hand-written** (4): search, get_contents, find_similar, answer

**other** (4): search_advanced, find_similar_advanced, get_contents_advanced, answer_advanced

**Research** (3): create_research_task*, list_research_tasks, get_research_task

**Websets** (6): create_webset*, list_websets, get_webset, update_webset*, delete_webset*, cancel_webset*

**Websets Preview** (1): preview_webset

**Items** (3): get_webset_item, delete_webset_item*, list_webset_items

**Enrichments** (5): create_webset_enrichment*, update_webset_enrichment*, get_webset_enrichment, delete_webset_enrichment*, cancel_webset_enrichment*

**Webhooks** (5): create_webhook*, list_webhooks, get_webhook, update_webhook*, delete_webhook*

**Webhooks Attempts** (1): list_webhook_attempts

**Events** (2): list_events, get_event

**Searches** (3): create_webset_search*, get_webset_search, cancel_webset_search*

**Monitors** (5): create_monitor*, list_monitors, get_monitor, update_monitor*, delete_monitor*

**Monitors Runs** (2): list_monitor_runs, get_monitor_run

**Imports** (5): create_import*, list_imports, get_import, update_import*, delete_import*

