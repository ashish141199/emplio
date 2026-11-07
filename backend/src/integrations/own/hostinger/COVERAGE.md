# Hostinger coverage

Source: Hostinger's OpenAPI spec (https://developers.hostinger.com/openapi/openapi.json), generated 2026-10-26
by `bun scripts/openapi-actions.ts hostinger`. Composio's Hostinger toolkit has 24 tools; n8n has no
Hostinger node. Every operation in the spec is an action (408) except the deprecated ones below.

## Deliberately left out

| What | Why |
| --- | --- |
| POST /api/hosting/v1/websites (hosting_createWebsiteV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| DELETE /api/reach/v1/contacts/{uuid} (reach_deleteAContactV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| GET /api/reach/v1/contacts/groups (reach_listContactGroupsV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| GET /api/reach/v1/contacts (reach_listContactsV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| POST /api/reach/v1/contacts (reach_createANewContactV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| GET /api/reach/v1/segmentation/segments (reach_listSegmentsV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| POST /api/reach/v1/segmentation/segments (reach_createANewContactSegmentV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| GET /api/reach/v1/segmentation/segments/{segmentUuid}/contacts (reach_listSegmentContactsV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| GET /api/reach/v1/segmentation/segments/{segmentUuid} (reach_getSegmentDetailsV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| POST /api/vps/v1/firewall/{firewallId}/sync/{virtualMachineId} (VPS_syncFirewallV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| POST /api/vps/v1/public-keys/attach/{virtualMachineId} (VPS_attachPublicKeyV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| DELETE /api/vps/v1/public-keys/{publicKeyId} (VPS_deletePublicKeyV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| GET /api/vps/v1/public-keys (VPS_getPublicKeysV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| POST /api/vps/v1/public-keys (VPS_createPublicKeyV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| GET /api/vps/v1/virtual-machines/{virtualMachineId}/public-keys (VPS_getAttachedPublicKeysV1) | Deprecated by Hostinger (Reach contacts and segments moved under profiles; VPS public keys to ssh-keys) |
| Events (triggers) | Own apps have no triggers yet. Hostinger has mail webhooks (mail_create_webhook is an action), the first to add when they come |
| OAuth | Hostinger only offers API tokens |

## Hand adjustments (scripts/openapi/hostinger.ts)

- Names: the V1 suffix dropped, "a"/"an" dropped, product names joined (wordpress, nodejs, litespeed, phpmyadmin).
- POSTs that only look things up run without asking: DNS validation, domain availability and name suggestions, Reach contact previews, WordPress install checks.
- GETs that show a secret ask first: a domain's transfer code, a WordPress admin token, a logged-in phpMyAdmin link.
- Buying (domains, VPS, renewals) and every other change asks first, as non-GETs always do.

## Auth

| Method | Status |
| --- | --- |
| API token (hPanel → Profile → API), sent as Bearer | done |

## Actions by group (* asks first)

**Agency Hosting: Datacenters** (1): agency_hosting_list_available_datacenters

**Agency Hosting: Domains** (4): agency_hosting_change_website_domain*, agency_hosting_link_domain_to_website*, agency_hosting_list_domains, agency_hosting_unlink_domain_from_website*

**Agency Hosting: Files** (2): agency_hosting_generate_upload_url*, agency_hosting_import_website_from_archive*

**Agency Hosting: Metrics** (2): agency_hosting_list_agency_plan_order_disk_usage_metrics, agency_hosting_list_order_resource_usage_metrics

**Agency Hosting: Orders** (1): agency_hosting_list_orders

**Agency Hosting: PHP** (7): agency_hosting_list_php_extensions_for_website, agency_hosting_replace_website_php_extensions*, agency_hosting_list_php_options_for_website, agency_hosting_replace_website_php_options*, agency_hosting_list_available_php_versions_for_order, agency_hosting_list_available_php_versions_for_website, agency_hosting_update_website_php_version*

**Agency Hosting: Website Setups** (2): agency_hosting_create_new_website*, agency_hosting_get_website_setup_status

**Agency Hosting: SSL** (4): agency_hosting_reinstall_website_ssl*, agency_hosting_install_website_ssl*, agency_hosting_get_website_ssl_status, agency_hosting_uninstall_website_ssl*

**Agency Hosting: Websites** (5): agency_hosting_build_website_nodejs_assets*, agency_hosting_get_website_details, agency_hosting_delete_website*, agency_hosting_list_agency_plan_websites, agency_hosting_list_website_processes

**Agency Hosting: Cache** (1): agency_hosting_clear_website_cache*

**Agency Hosting: Cron Jobs** (3): agency_hosting_list_website_cron_jobs, agency_hosting_create_website_cron_job*, agency_hosting_delete_website_cron_job*

**Agency Hosting: Databases** (5): agency_hosting_list_website_databases, agency_hosting_create_website_database*, agency_hosting_delete_website_database*, agency_hosting_create_website_database_user*, agency_hosting_delete_website_database_user*

**Agency Hosting: WordPress** (3): agency_hosting_change_wordpress_version*, agency_hosting_get_wordpress_settings, agency_hosting_list_available_wordpress_versions

**Agent Readiness: Checks** (1): agent_readiness_list_checks

**Agent Readiness: Scans** (2): agent_readiness_run_agent_readiness_scan*, agent_readiness_get_agent_readiness_scan

**Billing: Catalog** (1): billing_get_catalog_item_list

**Billing: Orders** (1): billing_create_purchase_order*

**Billing: Payment methods** (3): billing_set_default_payment_method*, billing_delete_payment_method*, billing_get_payment_method_list

**Billing: Subscriptions** (4): billing_get_subscription_list, billing_disable_auto_renewal*, billing_enable_auto_renewal*, billing_renew_subscription*

**DNS: Snapshot** (3): dns_get_dns_snapshot, dns_get_dns_snapshot_list, dns_restore_dns_snapshot*

**DNS: Zone** (5): dns_get_dns_records, dns_update_dns_records*, dns_delete_dns_records*, dns_reset_dns_records*, dns_validate_dns_records

**Domain Access Verifier: Verifications** (1): domains_get_verifications

**Domains: Availability** (3): domains_suggest_domain_names_from_description, domains_suggest_domain_names_from_domain, domains_check_domain_availability

**Domains: Forwarding** (4): domains_get_domain_forwarding, domains_update_domain_forwarding*, domains_delete_domain_forwarding*, domains_create_domain_forwarding*

**Domains: WHOIS** (10): domains_get_pending_irtp_verification, domains_cancel_pending_irtp_verification*, domains_change_whois_profile_for_domain*, domains_set_whois_profile_as_default*, domains_unset_default_whois_profile*, domains_get_whois_profile, domains_delete_whois_profile*, domains_get_whois_profile_list, domains_create_whois_profile*, domains_get_whois_profile_usage

**Domains: Move** (8): domains_get_incoming_domain_move, domains_accept_incoming_domain_move*, domains_reject_incoming_domain_move*, domains_get_incoming_domain_move_list, domains_get_outgoing_domain_move, domains_start_outgoing_domain_move*, domains_cancel_outgoing_domain_move*, domains_get_outgoing_domain_move_list

**Domains: Portfolio** (12): domains_get_domain_authorization_code*, domains_claim_free_domain*, domains_enable_domain_lock*, domains_disable_domain_lock*, domains_get_domain_details, domains_get_domain_list, domains_purchase_new_domain*, domains_enable_privacy_protection*, domains_disable_privacy_protection*, domains_get_domain_renewal_information, domains_complete_domain_setup*, domains_update_domain_nameservers*

**Domains: Transfer** (4): domains_claim_free_domain_transfer*, domains_get_transfer, domains_get_transfer_list, domains_start_domain_transfer*

**Ecommerce: Discounts** (2): ecommerce_list_discounts, ecommerce_create_discount*

**Ecommerce: Miscellaneous** (1): ecommerce_get_custom_storefront_setup_instructions

**Ecommerce: Orders** (4): ecommerce_cancel_order*, ecommerce_fulfil_order*, ecommerce_list_store_orders, ecommerce_retrieve_order

**Ecommerce: Payments** (3): ecommerce_enable_manual_payment_method*, ecommerce_create_payment_provider_connect_link*, ecommerce_list_store_payment_providers

**Ecommerce: Products** (7): ecommerce_create_product_image_upload_url*, ecommerce_delete_product*, ecommerce_update_product*, ecommerce_create_digital_product*, ecommerce_list_products, ecommerce_create_physical_product*, ecommerce_upload_and_attach_product_image*

**Ecommerce: Sales channels** (3): ecommerce_list_sales_channels, ecommerce_create_sales_channel*, ecommerce_update_sales_channel*

**Ecommerce: Shipping** (1): ecommerce_set_store_shipping*

**Ecommerce: Stores** (4): ecommerce_delete_store*, ecommerce_get_stores, ecommerce_create_store*, ecommerce_get_store_metadata

**Ecommerce: Product variants** (4): ecommerce_update_product_variants_in_batch*, ecommerce_delete_product_variant*, ecommerce_list_product_variants, ecommerce_create_product_variant*

**Horizons: Websites** (6): horizons_clone_website*, horizons_get_website_list, horizons_create_website*, horizons_edit_website*, horizons_publish_website*, horizons_get_website

**Hosting: Cache** (3): hosting_clear_website_cache*, hosting_toggle_cacheless_mode*, hosting_toggle_website_cache*

**Hosting: CDN** (4): hosting_disable_cdn*, hosting_enable_cdn*, hosting_purge_cdn_cache*, hosting_get_cdn_status

**Hosting: Cron Jobs** (4): hosting_list_account_cron_jobs, hosting_create_account_cron_job*, hosting_delete_account_cron_job*, hosting_get_cron_job_output

**Hosting: Databases** (10): hosting_change_database_password*, hosting_list_account_databases, hosting_create_account_database*, hosting_delete_account_database*, hosting_create_database_remote_connection*, hosting_delete_database_remote_connection*, hosting_list_database_remote_connections, hosting_repair_database*, hosting_setup_website_database*, hosting_get_phpmyadmin_link*

**Hosting: Datacenters** (1): hosting_list_available_datacenters

**Hosting: Domains** (8): hosting_generate_free_subdomain*, hosting_list_website_parked_domains, hosting_create_website_parked_domain*, hosting_delete_website_parked_domain*, hosting_list_website_subdomains, hosting_create_website_subdomain*, hosting_delete_website_subdomain*, hosting_verify_domain_ownership*

**Hosting: Files** (3): hosting_generate_upload_url*, hosting_list_website_files_and_directories, hosting_get_website_file_content

**Hosting: Git** (9): hosting_get_git_auto_deployment_settings, hosting_update_git_auto_deployment_settings*, hosting_delete_git_auto_deployment_settings*, hosting_list_git_installations, hosting_list_git_installation_repositories, hosting_deploy_website_git_repository*, hosting_list_website_git_repositories, hosting_get_git_ssh_public_key, hosting_generate_git_ssh_key*

**Hosting: Headless** (1): hosting_submit_headless_build_report*

**Hosting: NodeJS** (16): hosting_list_nodejs_builds, hosting_start_nodejs_build*, hosting_get_nodejs_build_settings, hosting_update_nodejs_build_settings*, hosting_get_nodejs_build_settings_from_archive, hosting_get_nodejs_build_settings_from_repository, hosting_list_nodejs_environment_variables, hosting_replace_nodejs_environment_variables*, hosting_analyse_failed_nodejs_build, hosting_get_nodejs_build_details, hosting_get_nodejs_build_logs, hosting_get_nodejs_runtime_logs, hosting_clear_nodejs_runtime_logs*, hosting_restart_nodejs_application*, hosting_list_nodejs_vulnerabilities, hosting_patch_nodejs_vulnerabilities*

**Hosting: Websites** (5): hosting_list_website_setups, hosting_start_website_setup*, hosting_list_websites, hosting_deploy_static_site_archive*, hosting_delete_website*

**Hosting: Orders** (1): hosting_list_orders

**Hosting: PHP** (6): hosting_reset_php_extensions*, hosting_get_php_details, hosting_get_php_info, hosting_update_php_extensions*, hosting_update_php_options*, hosting_update_php_version*

**Hosting: Redirects** (3): hosting_list_website_redirects, hosting_create_website_redirect*, hosting_delete_website_redirect*

**Hosting: SSL** (4): hosting_install_ssl*, hosting_get_ssl_status, hosting_toggle_https_redirect*, hosting_uninstall_ssl*

**Mail: Aliases** (3): mail_create_alias*, mail_delete_alias*, mail_list_aliases

**Mail: API Tokens** (3): mail_create_api_token*, mail_revoke_api_token*, mail_list_api_tokens

**Mail: Autoreplies** (4): mail_create_autoreply*, mail_update_autoreply*, mail_delete_autoreply*, mail_list_autoreplies

**Mail: Catchalls** (4): mail_create_catch_all*, mail_delete_catch_all*, mail_list_catch_alls, mail_resend_catch_all_confirmation*

**Mail: Forwarders** (5): mail_create_forwarder*, mail_delete_forwarder*, mail_list_forwarders, mail_resend_forwarder_confirmation*, mail_update_forwarder_keep_copy_setting*

**Mail: Logs** (5): mail_list_access_logs, mail_list_action_logs, mail_list_inbound_logs, mail_list_mailbox_action_logs, mail_list_outbound_logs

**Mail: Mailboxes** (4): mail_list_mailboxes, mail_create_mailbox*, mail_delete_mailbox*, mail_change_mailbox_password*

**Mail: Orders** (2): mail_list_orders, mail_get_order_plan

**Mail: Webhooks** (8): mail_create_webhook*, mail_list_webhook_delivery_logs, mail_get_webhook, mail_delete_webhook*, mail_update_webhook*, mail_list_webhooks, mail_regenerate_webhook_secret*, mail_test_webhook*

**Reach: Automations** (3): reach_get_automation_details, reach_list_automations, reach_list_automation_steps

**Reach: Campaigns** (4): reach_get_campaign_details, reach_list_campaigns, reach_create_draft_campaign*, reach_get_campaign_performance

**Reach: Contact Fields** (4): reach_delete_contact_field*, reach_update_contact_field*, reach_list_contact_fields, reach_create_contact_field*

**Reach: Contacts** (6): reach_get_contact_details, reach_delete_profile_contact*, reach_update_contact*, reach_create_contacts_in_bulk*, reach_list_profile_contacts, reach_create_new_contacts*

**Reach: Segments** (9): reach_count_profile_segment_contacts, reach_list_profile_segment_contacts, reach_get_profile_segment_details, reach_update_profile_segment*, reach_delete_profile_segment*, reach_list_segment_filter_attributes, reach_preview_contacts_matching_conditions, reach_list_profile_segments, reach_create_profile_segment*

**Reach: Tags** (8): reach_assign_contact_to_tag*, reach_remove_contact_from_tag*, reach_assign_contacts_to_tag*, reach_remove_contacts_from_tag*, reach_delete_tag*, reach_rename_tag*, reach_list_profile_tags, reach_create_or_find_tags*

**Reach: Forms** (9): reach_get_form_details, reach_delete_form*, reach_update_form*, reach_duplicate_form*, reach_list_forms, reach_create_form*, reach_add_form_submitter_tags*, reach_remove_form_submitter_tag*, reach_update_form_template*

**Reach: Profiles** (9): reach_get_connected_sending_domain, reach_connect_sending_domain*, reach_delete_sending_domain*, reach_get_profile_domain_dns_status, reach_list_plan_feature_access, reach_get_remaining_plan_limits, reach_list_profiles, reach_get_profile_settings, reach_update_profile_settings*

**Reach: Templates** (2): reach_list_email_templates, reach_create_email_template*

**VPS: Data centers** (1): vps_get_data_center_list

**VPS: Docker Manager** (10): vps_get_project_containers, vps_get_project_contents, vps_delete_project*, vps_get_project_list, vps_create_new_project*, vps_get_project_logs, vps_restart_project*, vps_start_project*, vps_stop_project*, vps_update_project*

**VPS: Firewall** (11): vps_activate_firewall*, vps_deactivate_firewall*, vps_get_firewall_details, vps_delete_firewall*, vps_get_firewall_list, vps_create_new_firewall*, vps_update_firewall_rule*, vps_delete_firewall_rule*, vps_replace_all_firewall_rules_in_group*, vps_create_firewall_rule*, vps_sync_firewall_to_all_assigned_vms*

**VPS: Post-install scripts** (5): vps_get_post_install_script, vps_update_post_install_script*, vps_delete_post_install_script*, vps_get_post_install_scripts, vps_create_post_install_script*

**VPS: SSH Keys** (3): vps_list_virtual_machine_ssh_keys, vps_add_virtual_machine_ssh_keys*, vps_remove_virtual_machine_ssh_keys*

**VPS: OS Templates** (2): vps_get_template_details, vps_get_templates

**VPS: Actions** (2): vps_get_action_details, vps_get_actions

**VPS: Backups** (2): vps_get_backups, vps_restore_backup*

**VPS: Virtual machine** (14): vps_set_hostname*, vps_reset_hostname*, vps_get_virtual_machine_details, vps_get_virtual_machines, vps_purchase_new_virtual_machine*, vps_get_metrics, vps_set_nameservers*, vps_set_panel_password*, vps_recreate_virtual_machine*, vps_restart_virtual_machine*, vps_set_root_password*, vps_setup_purchased_virtual_machine*, vps_start_virtual_machine*, vps_stop_virtual_machine*

**VPS: Malware scanner** (3): vps_get_scan_metrics, vps_install_monarx*, vps_uninstall_monarx*

**VPS: PTR records** (2): vps_create_ptr_record*, vps_delete_ptr_record*

**VPS: Recovery** (2): vps_start_recovery_mode*, vps_stop_recovery_mode*

**VPS: Snapshots** (4): vps_get_snapshot, vps_create_snapshot*, vps_delete_snapshot*, vps_restore_snapshot*

**WordPress: AI Content** (2): hosting_generate_images*, hosting_get_generation_result

**WordPress: AI Tools** (2): hosting_show_ai_option_status, hosting_set_ai_option_status*

**WordPress: Installations** (10): hosting_check_if_wordpress_installations_are_valid, hosting_delete_wordpress_installation*, hosting_detect_wordpress_installations*, hosting_import_wordpress_website*, hosting_install_wordpress*, hosting_list_wordpress_installations, hosting_list_available_wordpress_core_updates, hosting_get_installation_jwt_token*, hosting_show_wordpress_core_version, hosting_update_wordpress_core*

**WordPress: LiteSpeed Cache** (2): hosting_purge_litespeed_cache*, hosting_show_litespeed_cache_status

**WordPress: Login** (1): hosting_create_login_links*

**WordPress: Maintenance** (2): hosting_show_maintenance_status, hosting_toggle_maintenance_mode*

**WordPress: Object Cache** (2): hosting_show_memcached_object_cache_status, hosting_toggle_memcached_object_cache*

**WordPress: Plugins** (12): hosting_activate_wordpress_plugin*, hosting_deactivate_wordpress_plugin*, hosting_deploy_wordpress_plugin*, hosting_install_wordpress_plugins*, hosting_list_available_wordpress_plugins, hosting_list_installed_wordpress_plugins, hosting_search_wordpress_plugins, hosting_list_suggested_wordpress_plugins, hosting_check_if_woocommerce_is_installed, hosting_uninstall_wordpress_plugins*, hosting_update_hostinger_wordpress_plugin*, hosting_update_wordpress_plugins*

**WordPress: Themes** (7): hosting_activate_wordpress_theme*, hosting_deploy_wordpress_theme*, hosting_install_wordpress_theme*, hosting_list_installed_wordpress_themes, hosting_list_wordpress_themes, hosting_uninstall_wordpress_themes*, hosting_update_wordpress_themes*
