// Sarvam: what the generator (../openapi-actions.ts) can't tell from the specs (model APIs, then Voice Agents).
import type { AppConfig } from "../openapi-actions";

const APPS = "https://apps.sarvam.ai/api";

export default {
  spec: ["https://docs.sarvam.ai/openapi/apis.json", "https://docs.sarvam.ai/openapi/voice-agents.json"],
  out: "src/integrations/own/sarvam/actions.json",
  // both specs list several servers without saying which serves what; docs.sarvam.ai's pages do
  server: (path, spec) => {
    if (spec === 0) return /^\/jobs/.test(path) ? "https://api.sarvam.ai/dubbing" : undefined;
    if (path.startsWith("/analytics/")) return APPS;
    if (/\/test-suites/.test(path)) return `${APPS}/evals`;
    if (/\/campaigns/.test(path)) return `${APPS}/scheduling`;
    if (/\/outbounds/.test(path)) return `${APPS}/outbounds`;
    return `${APPS}/app-authoring`;
  },
  // speechToTextJob_get_status → speech_to_text_job_get_status; v1Deployments_create-deployment → create_deployment;
  // externalBoards_listBoards → list_boards
  name: (id) => id.replace(/^(v1_[a-z]+|external_[a-z]+(_suite)?|outbound_api|key_management)_/, ""),
  rename: {
    speech_to_text_transcribe: "speech_to_text",
    speech_to_text_translate: "speech_to_text_translate",
    text_to_speech_convert: "text_to_speech",
    text_to_speech_convert_stream: "text_to_speech_audio",
    voice_cloning_convert: "text_to_speech_cloned_voice",
    voice_cloning_convert_stream: "text_to_speech_cloned_voice_audio",
    voice_cloning_create_voice: "create_cloned_voice",
    voice_cloning_list_voices: "list_cloned_voices",
    voice_cloning_get_voice: "get_cloned_voice",
    voice_cloning_delete_voice: "delete_cloned_voice",
    text_translate: "translate",
    text_transliterate: "transliterate",
    text_identify_language: "identify_language",
    chat_completions_v2: "chat_completion",
    chat_completions: "chat_completion_v1",
    chat_completion_get_model_v2: "get_model",
    chat_completion_list_models_v2: "list_models",
    responses_create_stream: "create_response",
    initiate_outbound_api: "start_outbound_call",
    get_paginated_attempts_api: "list_call_attempts",
    get_external_interactions_api: "list_interactions",
    get_recordings_api: "get_recording",
    get_forwarded_recording_api: "get_forwarded_recording",
    get_transcripts_api: "get_transcript",
    get_trace_api: "get_trace",
    // campaigns' twins of the deployment calls
    list_webhook_deliveries: "list_campaign_webhook_deliveries",
    retry_webhook_deliveries: "retry_campaign_webhook_deliveries",
    upload_cohort: "upload_campaign_cohort",
    stream_cohort: "stream_campaign_cohort",
    list_cohorts: "list_campaign_cohorts",
    get_cohort: "get_campaign_cohort",
    download_cohort_file: "download_campaign_cohort_file",
    create_mapping: "create_test_suite_mapping",
    get_mapping: "get_test_suite_mapping",
    list_runs: "list_test_suite_runs",
    get_run: "get_test_suite_run",
    create_suite_run: "run_test_suite",
    create_test_case_run: "run_test_case",
  },
  skip: {
    "keyManagement_obtainAJwtAccessToken": "runs on the business's own key server (bring-your-own-key encryption), not Sarvam's",
    "keyManagement_decryptAnEncryptedDataEncryptionKeyDek": "runs on the business's own key server (bring-your-own-key encryption), not Sarvam's",
    "keyManagement_generateANewDataEncryptionKeyDek": "runs on the business's own key server (bring-your-own-key encryption), not Sarvam's",
  },
  // answers only, billed per use, nothing changed (like the AI apps' generate)
  reads: [
    "speech_to_text",
    "speech_to_text_translate",
    "text_to_speech",
    "text_to_speech_audio",
    "text_to_speech_cloned_voice",
    "text_to_speech_cloned_voice_audio",
    "translate",
    "transliterate",
    "identify_language",
    "chat_completion",
    "chat_completion_v1",
    "create_response",
    "run_tab",
    "run_widget",
    "preview_query",
  ],
  // the key, which the app sends itself
  drop: { "*": ["X-API-Key", "api-subscription-key", "Authorization"] },
  params: {
    org_id: "The organization's id, from the Sarvam dashboard URL or Settings",
    workspace_id: "The workspace's id, from the Sarvam dashboard URL or Settings",
    app_id: "The voice agent's id (its app id), from the agent's page in the Sarvam dashboard",
  },
} satisfies AppConfig;
