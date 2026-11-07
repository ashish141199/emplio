# Vercel coverage

Source: Vercel's OpenAPI spec (https://openapi.vercel.sh/), generated 2026-10-26 by `bun scripts/openapi-actions.ts vercel`.
Composio's Vercel toolkit has 35 tools; n8n has no Vercel node. Every operation in the spec is an action
(462) except the deprecated ones below. Re-run the script when Vercel adds endpoints; it fails if
an override in it no longer matches an operation.

## Deliberately left out

| What | Why |
| --- | --- |
| POST /v1/deployments/{deploymentId}/checks (createCheck) | Deprecated by Vercel (checks moved to checks-v2; resource secrets to update_resource_secrets_by_id) |
| GET /v1/deployments/{deploymentId}/checks (getAllChecks) | Deprecated by Vercel (checks moved to checks-v2; resource secrets to update_resource_secrets_by_id) |
| GET /v1/deployments/{deploymentId}/checks/{checkId} (getCheck) | Deprecated by Vercel (checks moved to checks-v2; resource secrets to update_resource_secrets_by_id) |
| PATCH /v1/deployments/{deploymentId}/checks/{checkId} (updateCheck) | Deprecated by Vercel (checks moved to checks-v2; resource secrets to update_resource_secrets_by_id) |
| POST /v1/deployments/{deploymentId}/checks/{checkId}/rerequest (rerequestCheck) | Deprecated by Vercel (checks moved to checks-v2; resource secrets to update_resource_secrets_by_id) |
| PUT /v1/installations/{integrationConfigurationId}/products/{integrationProductIdOrSlug}/resources/{resourceId}/secrets (update-resource-secrets) | Deprecated by Vercel (checks moved to checks-v2; resource secrets to update_resource_secrets_by_id) |
| `decrypt` on filter_project_envs | Listing env vars never shows values; get_project_env does, after an OK |
| Events (triggers) | Own apps have no triggers yet. Vercel has webhooks (create_webhook / delete_webhook are actions), so deploy-succeeded/failed events are the first to add when triggers come to own apps |
| OAuth sign-in | Needs us registered as a Vercel integration; a pasted access token reaches the same API |

## Hand adjustments (scripts/openapi/vercel.ts, own/vercel/index.ts)

- Renamed operation ids that came out unreadable (registry, experimentation, sandboxes, DNS records).
- POSTs that only look things up run without asking: artifact_query, search_domains, get_bulk_price, get_bulk_availability, lookup_flag_labels, read_session_file.
- GETs that show a secret ask first: get_project_env, get_shared_env_var, get_domain_auth_code, get_edge_config_token(s), get_sdk_keys.
- At run time: streamed logs are read for 10 s or 1000 lines; downloads come back as files; upload_file works out the SHA1 itself; a 403 with `invalidToken` asks to reconnect.

## Auth

| Method | Status |
| --- | --- |
| Access token (vercel.com/account/settings/tokens), sent as Bearer | done |
| OAuth (Vercel integration) | skipped, see above |

## Actions by group (* asks first)

**access-groups** (11): read_access_group, update_access_group*, delete_access_group*, list_access_group_members, list_access_groups, create_access_group*, list_access_group_projects, create_access_group_project*, read_access_group_project, update_access_group_project*, delete_access_group_project*

**ai-gateway** (20): create_ai_gateway_virtual_model_config*, get_ai_gateway_virtual_model_config, update_ai_gateway_virtual_model_config*, delete_ai_gateway_virtual_model_config*, list_ai_gateway_virtual_model_configs, get_ai_gateway_virtual_model_config_by_slug, update_ai_gateway_virtual_model_config_by_slug*, delete_ai_gateway_virtual_model_config_by_slug*, list_ai_gateway_routers, create_ai_gateway_rule*, list_ai_gateway_rules, update_ai_gateway_rule*, delete_ai_gateway_rule*, list_ai_gateway_budgets, upsert_ai_gateway_budget*, archive_ai_gateway_budget*, list_ai_gateway_budget_defaults, upsert_ai_gateway_budget_default*, archive_ai_gateway_budget_default*, update_api_key_quota*

**artifacts** (6): record_events*, artifacts_status, upload_artifact*, download_artifact, artifact_query, delete_all_artifacts*

**billing** (3): list_billing_charges, list_contract_commitments, buy_credits*

**bulk-redirects** (7): stage_redirects*, get_redirects, delete_redirects*, edit_redirect*, restore_redirects*, get_redirect_versions, update_redirect_version*

**checks-v2** (10): list_project_checks, create_project_check*, get_project_check, update_project_check*, delete_project_check*, list_check_runs, list_deployment_check_runs, create_deployment_check_run*, get_deployment_check_run, update_deployment_check_run*

**networking** (11): list_networks, create_network*, delete_network*, update_network*, read_network, create_private_link_endpoint*, list_private_link_endpoints, read_private_link_endpoint, delete_private_link_endpoint*, update_private_link_endpoint*, update_static_ips*

**connect** (14): list_connectors, get_connector, delete_connector*, create_connector*, update_connector*, replace_connector_trigger_destinations*, eject_managed_connector*, list_connector_project_connections, get_connector_project_connection, upsert_connector_project_connection*, delete_connector_project_connection*, list_project_connector_connections, get_connector_token*, create_connector_authorization_request*

**daemons** (3): get_project_boxes, put_project_daemon_instances*, restart_project_daemon_instance*

**deployments** (10): get_deployment_events, update_integration_deployment_action*, get_deployment, create_deployment*, cancel_deployment*, upload_file*, list_deployment_files, get_deployment_file_contents, get_deployments, delete_deployment*

**dns** (4): get_dns_records, create_dns_record*, update_dns_record*, remove_dns_record*

**other** (8): replace_domains_by_domain_records*, get_domains_records_by_record_id, create_api_keys*, create_observability_query*, get_observability_schema, get_observability_schema_by_metric_id, create_speed_insights_toggle*, create_web_insights_toggle*

**domains-registrar** (19): search_domains, get_supported_tlds, get_tld, get_tld_price, get_domain_availability, get_domain_price, get_bulk_price, get_bulk_availability, get_contact_info_schema, get_domain_auth_code*, buy_single_domain*, buy_domains*, transfer_in_domain*, get_domain_transfer_in, renew_domain*, update_domain_auto_renew*, update_domain_nameservers*, get_domain_contact_verification, get_order

**domains** (9): get_domain_config, get_domain_verification_record, claim_domain_ownership*, get_domain_project_domains, get_domain, get_domains, create_or_transfer_domain*, patch_domain*, delete_domain*

**logDrains** (7): get_configurable_log_drain, delete_configurable_log_drain*, get_all_log_drains, create_configurable_log_drain*, get_integration_log_drains, create_log_drain*, delete_integration_log_drain*

**drains** (6): create_drain*, get_drains, delete_drain*, get_drain, update_drain*, test_drain*

**edge-cache** (4): invalidate_by_tags*, dangerously_delete_by_tags*, invalidate_by_src_images*, dangerously_delete_by_src_images*

**global-config** (18): get_edge_configs, create_edge_config*, get_edge_config, update_edge_config*, delete_edge_config*, get_edge_config_items, patch_edge_config_items*, get_edge_config_schema, patch_edge_config_schema*, delete_edge_config_schema*, get_edge_config_item, get_edge_config_tokens*, delete_edge_config_tokens*, get_edge_config_token*, create_edge_config_token*, get_edge_config_backup, restore_edge_config_backup*, get_edge_config_backups

**environment** (11): create_shared_env_variable*, list_shared_env_variable, update_shared_env_variable*, delete_shared_env_variable*, get_shared_env_var*, unlink_shared_env_variable*, create_custom_environment*, list_custom_environments, get_custom_environment, update_custom_environment*, remove_custom_environment*

**user** (4): list_user_events, list_event_types, get_auth_user, request_delete*

**feature-flags** (24): list_flags_v2, list_flags, create_flag*, get_flag, update_flag*, delete_flag*, list_flag_versions, get_flag_settings, update_flag_settings*, list_flag_labels, list_flag_label_counts, lookup_flag_labels, list_team_flag_settings, list_team_flags_v2, list_team_flags, create_flag_segment*, list_flag_segments, get_flag_segment, delete_flag_segment*, update_flag_segment*, get_deployment_feature_flags, get_sdk_keys*, create_sdk_key*, delete_sdk_key*

**integrations** (9): git_namespaces, search_repo, get_billing_plans, connect_integration_resource_to_project*, get_configurations, get_configuration, delete_configuration*, get_configuration_products, create_integration_store_direct*

**marketplace** (23): update_installation*, get_account_info, get_installation_member, rotate_installation_credential*, revoke_installation_credential*, create_installation_event*, get_integration_resources, get_integration_resource, delete_integration_resource*, import_resource*, update_resource*, submit_billing_data*, submit_invoice*, finalize_installation*, get_invoice, update_invoice*, submit_prepayment_balances*, update_resource_secrets_by_id*, create_experimentation_items*, update_experimentation_item*, delete_experimentation_item*, get_experimentation_global_config, push_experimentation_global_config*

**authentication** (5): exchange_sso_token*, list_auth_tokens, create_auth_token*, get_auth_token, delete_auth_token*

**kms** (13): sign_kms_message*, sign_kms_token*, list_kms_issuers, create_kms_issuer*, create_kms_signing_key*, activate_kms_signing_key*, revoke_kms_signing_key*, get_kms_issuer, update_kms_issuer*, delete_kms_issuer*, create_kms_issuer_policy*, update_kms_issuer_policy*, delete_kms_issuer_policy*

**logs** (1): get_runtime_logs

**microfrontends** (5): get_microfrontends_groups, get_microfrontends_in_group, get_microfrontends_config, get_microfrontends_config_for_project, create_microfrontends_group_with_applications*

**observability** (2): get_observability_configuration_projects, update_observability_configuration_project*

**organizations** (7): create_organization*, list_organizations, get_organization, update_organization*, list_organization_teams, add_organization_team*, remove_organization_team*

**projectMembers** (3): get_project_members, add_project_member*, remove_project_member*

**project-routes** (8): get_routes, stage_routes*, add_route*, delete_routes*, edit_route*, generate_route*, get_route_versions, update_route_versions*

**projects** (33): get_projects, get_project_trace, create_project*, get_project_token*, create_trace_session*, get_project, update_project*, delete_project*, upload_project_avatar*, delete_project_avatar*, get_project_domains, get_project_domain, update_project_domain*, remove_project_domain*, add_project_domain*, move_project_domain*, verify_project_domain*, filter_project_envs, create_project_env*, get_project_env*, remove_project_env*, edit_project_env*, batch_remove_project_env*, create_project_transfer_request*, accept_project_transfer_request*, update_project_protection_bypass*, request_rollback*, update_rollback_description*, update_microfrontends*, request_promote*, list_promote_aliases, pause_project*, unpause_project*

**rolling-release** (8): get_rolling_release_billing_status, get_rolling_release_config, delete_rolling_release_config*, update_rolling_release_config*, get_rolling_release, approve_rolling_release_stage*, start_rolling_release*, complete_rolling_release*

**sandboxes** (33): list_named_sandboxes, create_sandbox_v2*, list_drives, get_drive, get_or_create_drive*, delete_drive*, fork_drive*, list_session_snapshots, get_session_snapshot, delete_session_snapshot*, list_sessions, get_session, get_named_sandbox, update_sandbox*, delete_sandbox*, list_session_commands, run_session_command*, get_session_command, kill_session_command*, write_session_command_stdin*, get_session_command_logs, stop_session*, extend_session_timeout*, update_session_network_policy*, read_session_file, create_session_directory*, write_session_files*, create_session_snapshot_v2*, fork_sandbox_v2*, create_sandbox_v3*, create_session_snapshot_v3*, fork_sandbox_v3*, create_sandbox_v4*

**security** (17): update_attack_challenge_mode*, get_security_firewall_config, put_firewall_config*, update_firewall_config*, get_firewall_config, delete_firewall_config_version*, activate_firewall_config_version*, get_active_attack_status, get_bypass_ip, add_bypass_ip*, remove_bypass_ip*, get_conditional_bypass, create_conditional_bypass*, delete_conditional_bypass*, get_security_firewall_events, get_security_firewall_events_summary, generate_firewall_rule*

**storage** (3): get_storage_stores_by_id, create_storage_stores_blob*, delete_storage_stores_blob_by_id*

**teams** (16): get_team_members, invite_user_to_team*, request_access_to_team*, get_team_access_request, join_team*, update_team_member*, remove_team_member*, get_team, patch_team*, get_teams, create_team*, post_team_dsync_roles*, delete_team*, delete_team_invite_code*, update_microfrontends_group*, delete_microfrontends_group*

**vcr** (25): create_repository*, list_repositories, get_repository, delete_repository*, list_repository_images, add_repository_permission*, remove_repository_permission*, list_repository_permissions, clear_repository_permissions*, list_repository_tags, get_repository_tag, get_repository_image, delete_repository_image*, registry_version_check, registry_get_blob, registry_delete_blob*, registry_get_blob_upload, registry_cancel_blob_upload*, registry_upload_blob_chunk*, registry_complete_blob_upload*, registry_start_blob_upload*, registry_push_manifest*, registry_get_manifest, registry_delete_manifest*, registry_list_tags

**vercel-ci** (23): get_vercel_ci_repository_settings, update_vercel_ci_repository_settings*, list_vercel_ci_invocations, list_vercel_ci_branches, create_vercel_ci_task_analysis*, get_vercel_ci_task_analysis, create_vercel_ci_task_configuration_pull_request*, list_vercel_ci_task_analysis_tasks, list_vercel_ci_invocation_attempts, get_vercel_ci_invocation_tree, get_vercel_ci_invocation, retry_vercel_ci_invocation*, list_vercel_ci_job_definitions, get_vercel_ci_job_definition, list_vercel_ci_job_runs, get_vercel_ci_job_run, list_vercel_ci_task_definitions, list_vercel_ci_task_runs, get_vercel_ci_invocation_logs, get_vercel_ci_task_logs, search_vercel_ci_logs, get_vercel_ci_job_run_logs, get_vercel_ci_task_run_logs

**web-analytics** (4): aggregate_pageviews, aggregate_events, count_pageviews, count_events

**webhooks** (4): create_webhook*, get_webhooks, get_webhook, delete_webhook*

**aliases** (6): list_deployment_aliases, assign_alias*, list_aliases, get_alias, delete_alias*, patch_url_protection_bypass*

**certs** (5): get_cert_by_id, remove_cert*, get_certs, issue_cert*, upload_cert*
