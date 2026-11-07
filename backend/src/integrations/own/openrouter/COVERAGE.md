# OpenRouter coverage

Source: OpenRouter's OpenAPI spec (https://openrouter.ai/openapi.json), generated 2026-10-26 by
`bun scripts/openapi-actions.ts openrouter`. `generate` and `list_models` are hand-written (own/ai.ts, through
the AI SDK); every other operation in the spec is an action (135), except the ones below.

## Deliberately left out

| What | Why |
| --- | --- |
| POST /auth/keys (exchangeAuthCodeForAPIKey), POST /auth/keys/code (createAuthKeysCode) | OpenRouter's sign-in for other apps; we connect with a pasted key |
| POST /oauth/token (createOauthToken) | Workload-identity exchange, form-encoded; not for a pasted key |
| POST /credits/coinbase | Deprecated by OpenRouter |
| HTTP-Referer, X-OpenRouter-Title, X-OpenRouter-Categories headers | Attribution for apps on openrouter.ai's rankings; nothing a business needs |
| Events (triggers) | OpenRouter has no webhooks; own apps have no triggers yet |

## Hand adjustments (scripts/openapi/openrouter.ts)

- Readable names for vague operation ids (`list` → list_keys, `send_chat_completion_request` → chat_completion…).
- Answers that change nothing run without asking (like `generate`): chat_completion, create_message, create_response,
  create_embeddings, create_rerank, create_audio_speech, create_audio_transcriptions, query_analytics. Images and
  video cost more, so they ask.

## Auth

| Method | Status |
| --- | --- |
| API key (openrouter.ai/settings/keys), sent as Bearer | done |
| OAuth PKCE | skipped, see above |

## Actions by group (* asks first)

**Analytics** (3): get_user_activity, get_analytics_meta, query_analytics

**alpha.decisions** (1): create_api_alpha_decisions*

**TTS** (1): create_audio_speech

**STT** (1): create_audio_transcriptions

**Batch** (4): list_batches, create_batch*, delete_batch*, get_batch

**Benchmarks** (1): get_benchmarks

**BYOK** (5): list_byok_keys, create_byok_key*, delete_byok_key*, get_byok_key, update_byok_key*

**Chat** (1): chat_completion

**Classifications** (1): get_task_classifications

**Containers** (4): list_container_files, get_container_file, download_container_file_content, promote_container_file*

**Credits** (1): get_credits

**Datasets** (3): get_app_rankings, get_rankings_daily, get_session_cost

**Embeddings** (2): create_embeddings, list_embeddings_models

**Endpoints** (2): list_endpoints_zdr, list_model_endpoints

**External Users** (5): list_external_users, create_external_user*, delete_external_user*, get_external_user, update_external_user*

**Files** (5): list_files, upload_file*, delete_file*, get_file_metadata, download_file_content

**Generations** (3): get_generation, list_generation_content, submit_generation_feedback*

**Guardrails** (13): list_guardrails, create_guardrail*, delete_guardrail*, get_guardrail, update_guardrail*, list_guardrail_key_assignments, bulk_assign_keys_to_guardrail*, bulk_unassign_keys_from_guardrail*, list_guardrail_member_assignments, bulk_assign_members_to_guardrail*, bulk_unassign_members_from_guardrail*, list_key_assignments, list_member_assignments

**Images** (3): create_image*, list_image_models, list_image_model_endpoints

**API Keys** (6): get_current_key, list_keys, create_key*, delete_key*, get_key, update_key*

**Anthropic Messages** (1): create_message

**Models** (4): get_model, get_all_models, list_models_count, list_models_user

**OAuth** (1): list_oauth_jwks

**Observability** (5): list_observability_destinations, create_observability_destination*, delete_observability_destination*, get_observability_destination, update_observability_destination*

**Organization** (3): list_organization_members, get_organization_settings, update_organization_settings*

**Presets** (7): list_presets, get_preset, create_presets_chat_completions*, create_presets_messages*, create_presets_responses*, list_preset_versions, get_preset_version

**Private Endpoints** (10): list_private_endpoints, create_private_endpoint*, delete_private_endpoint*, get_private_endpoint, update_private_endpoint*, activate_private_endpoint*, disable_private_endpoint*, enable_private_endpoint*, update_private_endpoint_pricing*, validate_private_endpoint*

**Providers** (1): list_providers

**Rerank** (1): create_rerank

**Responses** (1): create_response

**SCIM** (8): list_scim_group_mappings, create_scim_group_mapping*, delete_scim_group_mapping*, get_scim_group_mapping, update_scim_group_mapping*, list_scim_groups, create_scim_sync_job*, get_scim_sync_job

**SystemOne** (1): create_systemone*

**Tools** (2): list_tools, get_tool

**Vault** (9): list_intern_connections, list_intern_effective_vault_secrets, list_intern_vault_secrets, delete_intern_vault_secret*, store_intern_vault_secret*, copy_vault_secrets_to_intern*, list_vault_secrets, delete_vault_secret*, store_vault_secret*

**Video Generation** (4): create_video*, get_video, download_video, list_videos_models

**Workspaces** (12): list_workspaces, create_workspace*, delete_workspace*, get_workspace, update_workspace*, list_workspace_members, bulk_add_workspace_members*, bulk_remove_workspace_members*, list_workspace_budgets, delete_workspace_budget*, get_workspace_budget, upsert_workspace_budget*

