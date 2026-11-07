# Sarvam AI coverage

Source: Sarvam's OpenAPI specs (https://docs.sarvam.ai/openapi/apis.json, model APIs; .../voice-agents.json,
Voice Agents), generated 2026-10-26 by `bun scripts/openapi-actions.ts sarvam`. Every operation in both is an
action (120), except the ones below.

## Deliberately left out

| What | Why |
| --- | --- |
| POST /auth, /decrypt-key, /rotate-key (key management) | Run on the business's own key server (bring-your-own-key encryption), not Sarvam's |
| Streaming speech-to-text / text-to-speech over WebSocket | Not in the spec; a live socket doesn't fit a single call. The REST and batch-job versions are all here |
| Events (triggers) | Own apps have no triggers yet. Deployments and campaigns post webhooks (URL set on the deployment/campaign) |

## Hand adjustments (scripts/openapi/sarvam.ts, own/sarvam/index.ts)

- The specs list several servers without saying which serves what; docs.sarvam.ai does: dubbing → api.sarvam.ai/dubbing;
  deployments → apps.sarvam.ai/api/app-authoring; campaigns → /scheduling; outbound calls → /outbounds; analytics and
  boards → /api; tests → /evals.
- The key goes in both `api-subscription-key` (model APIs) and `X-API-Key` (Voice Agents); the specs' own key params are dropped.
- text_to_speech and text_to_speech_cloned_voice hand back WAV files instead of base64.
- Model calls that only answer run without asking (speech, translation, chat, run_tab/run_widget/preview_query).
- Voice Agents calls need org_id and workspace_id (from the dashboard URL or Settings); there's no call that lists them.

## Auth

| Method | Status |
| --- | --- |
| API subscription key (dashboard.sarvam.ai) | done |
| Voice Agents API key (Settings → API Key), same field | done — if their key differs from the model key, connect Sarvam twice |

## Actions by group (* asks first)

**speechToText** (2): speech_to_text, speech_to_text_translate

**speechToTextJob** (5): speech_to_text_job_initialise*, speech_to_text_job_get_upload_links*, speech_to_text_job_start*, speech_to_text_job_get_status, speech_to_text_job_get_download_links*

**textToSpeech** (2): text_to_speech, text_to_speech_audio

**voiceCloning** (6): create_cloned_voice*, text_to_speech_cloned_voice, text_to_speech_cloned_voice_audio, list_cloned_voices, get_cloned_voice, delete_cloned_voice*

**pronunciationDictionary** (5): pronunciation_dictionary_create*, pronunciation_dictionary_list, pronunciation_dictionary_update*, pronunciation_dictionary_delete*, pronunciation_dictionary_get

**text** (3): translate, transliterate, identify_language

**chat** (2): chat_completion_v1, chat_completion

**chatCompletion** (2): get_model, list_models

**responses** (1): create_response

**dubbing** (4): dubbing_create*, dubbing_start*, dubbing_get_live_status, dubbing_get_export_status

**documentTranslation** (5): document_translation_create*, document_translation_start*, document_translation_get_live_status, document_translation_trigger_export*, document_translation_get_export_status

**docAi** (6): doc_ai_create_upload_url*, doc_ai_digitise*, doc_ai_extract*, doc_ai_get_status, doc_ai_get_results, doc_ai_get_download_url

**speechToTextTranslateJob** (5): speech_to_text_translate_job_initialise*, speech_to_text_translate_job_get_upload_links*, speech_to_text_translate_job_start*, speech_to_text_translate_job_get_status, speech_to_text_translate_job_get_download_links*

**documentIntelligence** (5): document_intelligence_initialise*, document_intelligence_get_upload_links*, document_intelligence_start*, document_intelligence_get_status, document_intelligence_get_download_links*

**v1-deployments** (6): create_deployment*, list_deployments, get_deployment, update_deployment*, delete_deployment*, update_deployment_status*

**v1-webhooks** (4): list_deployment_webhook_deliveries, retry_deployment_webhook_deliveries*, list_campaign_webhook_deliveries, retry_campaign_webhook_deliveries*

**v1-cohorts** (10): upload_deployment_cohort*, stream_deployment_cohort*, list_deployment_cohorts, get_deployment_cohort, download_deployment_cohort_file, upload_campaign_cohort*, stream_campaign_cohort*, list_campaign_cohorts, get_campaign_cohort, download_campaign_cohort_file

**v1-campaigns** (5): create_campaign*, list_campaigns, get_campaign, update_campaign*, update_campaign_status*

**outboundApi** (1): start_outbound_call*

**external_endpoints** (6): list_call_attempts, list_interactions, get_recording, get_forwarded_recording, get_transcript, get_trace

**external_boards** (20): list_boards, create_board*, get_board, update_board*, duplicate_board*, create_tab*, update_tab*, run_tab, create_widget*, update_widget*, duplicate_widget*, run_widget, list_filters, update_filter*, create_notification_rule*, list_notification_rules, get_notification_rule, update_notification_rule*, get_query_schema, preview_query

**external_test_suite** (15): list_test_suites, create_test_suite*, get_test_suite, update_test_suite*, create_test_case*, get_test_case, update_test_case*, duplicate_test_case*, create_test_suite_mapping*, get_test_suite_mapping, run_test_suite*, list_test_suite_runs, run_test_case*, get_test_suite_run, get_test_case_results

