# Plivo coverage

Sources, swept 26 Oct 2026: Plivo's API reference (plivo.com/docs: account, messaging, 10DLC, toll-free
verification, WhatsApp templates, voice, audio streams, multi-party calls, Verify, number compliance, SIP auth,
Zentrunk), the resource files of the official SDKs (plivo-python, plivo-node, plivo-go, plivo-ruby).
n8n's Plivo node (send SMS/MMS, make a call) is a subset.

245 actions. Every endpoint found is an action except the ones below. Multipart uploads (media, LOA,
compliance documents, addresses, identities) take files as {"file": "/work/..."}.

## Deliberately left out

| What | Why |
| --- | --- |
| GET/DELETE /Message/{uuid}/Media/{media_id}/ | In older docs only; the current reference and all four SDKs list just `list_message_media`. |
| Events (incoming SMS, call status callbacks) | Own apps have no triggers yet. Callbacks are URLs the agent can set (`message_url`, `answer_url`, `url`, …) |
| Signature validation (X-Plivo-Signature-V3) | For servers receiving Plivo webhooks, not an API call |

## Auth

| Method | Status |
| --- | --- |
| Auth ID + Auth Token (HTTP Basic), pasted as `AUTH_ID:AUTH_TOKEN` | done; `check` refuses a key without the colon, then reads GET /v1/Account/{auth_id}/ |
| Subaccount credentials | done, same format (its own Auth ID/Token) |
| OAuth | Plivo has none |

## Actions

Paths are under `https://api.plivo.com` unless a host is shown. Readonly = every GET plus nothing else
(`lookup_number` is a GET; `validate_verify_session` changes the session's state, so it asks first).

### Account, subaccounts, applications, SIP endpoints, SIP auth, pricing, SDK tokens (31)

| Action | Method | Path | Status |
| --- | --- | --- | --- |
| get_account | GET | `/v1/Account/{auth_id}/` | done |
| update_account | POST | `/v1/Account/{auth_id}/` | done |
| list_subaccounts | GET | `/v1/Account/{auth_id}/Subaccount/` | done |
| get_subaccount | GET | `/v1/Account/{auth_id}/Subaccount/{auth_id}/` | done |
| create_subaccount | POST | `/v1/Account/{auth_id}/Subaccount/` | done |
| update_subaccount | POST | `/v1/Account/{auth_id}/Subaccount/{auth_id}/` | done |
| delete_subaccount | DELETE | `/v1/Account/{auth_id}/Subaccount/{auth_id}/` | done |
| list_applications | GET | `/v1/Account/{auth_id}/Application/` | done |
| get_application | GET | `/v1/Account/{auth_id}/Application/{app_id}/` | done |
| create_application | POST | `/v1/Account/{auth_id}/Application/` | done |
| update_application | POST | `/v1/Account/{auth_id}/Application/{app_id}/` | done |
| delete_application | DELETE | `/v1/Account/{auth_id}/Application/{app_id}/` | done |
| list_endpoints | GET | `/v1/Account/{auth_id}/Endpoint/` | done |
| get_endpoint | GET | `/v1/Account/{auth_id}/Endpoint/{endpoint_id}/` | done |
| create_endpoint | POST | `/v1/Account/{auth_id}/Endpoint/` | done |
| update_endpoint | POST | `/v1/Account/{auth_id}/Endpoint/{endpoint_id}/` | done |
| delete_endpoint | DELETE | `/v1/Account/{auth_id}/Endpoint/{endpoint_id}/` | done |
| list_sip_credentials | GET | `/v1/Account/{auth_id}/SipAuth/Credential/` | done |
| get_sip_credential | GET | `/v1/Account/{auth_id}/SipAuth/Credential/{credential_uuid}/` | done |
| create_sip_credential | POST | `/v1/Account/{auth_id}/SipAuth/Credential/` | done |
| update_sip_credential | POST | `/v1/Account/{auth_id}/SipAuth/Credential/{credential_uuid}/` | done |
| delete_sip_credential | DELETE | `/v1/Account/{auth_id}/SipAuth/Credential/{credential_uuid}/` | done |
| list_sip_ip_lists | GET | `/v1/Account/{auth_id}/SipAuth/IpAccessControlList/` | done |
| get_sip_ip_list | GET | `/v1/Account/{auth_id}/SipAuth/IpAccessControlList/{ip_acl_uuid}/` | done |
| create_sip_ip_list | POST | `/v1/Account/{auth_id}/SipAuth/IpAccessControlList/` | done |
| update_sip_ip_list | POST | `/v1/Account/{auth_id}/SipAuth/IpAccessControlList/{ip_acl_uuid}/` | done |
| delete_sip_ip_list | DELETE | `/v1/Account/{auth_id}/SipAuth/IpAccessControlList/{ip_acl_uuid}/` | done |
| add_sip_ip_list_entry | POST | `/v1/Account/{auth_id}/SipAuth/IpAccessControlList/{ip_acl_uuid}/Entry/` | done |
| remove_sip_ip_list_entry | DELETE | `/v1/Account/{auth_id}/SipAuth/IpAccessControlList/{ip_acl_uuid}/Entry/{entry_id}/` | done |
| get_pricing | GET | `/v1/Account/{auth_id}/Pricing/` | done |
| create_sdk_token | POST | `/v1/Account/{auth_id}/JWT/Token/` | done |

### Messaging (62)

| Action | Method | Path | Status |
| --- | --- | --- | --- |
| send_message | POST | `/v1/Account/{auth_id}/Message/` | done |
| get_message | GET | `/v1/Account/{auth_id}/Message/{message_uuid}/` | done |
| list_messages | GET | `/v1/Account/{auth_id}/Message/` | done |
| list_message_media | GET | `/v1/Account/{auth_id}/Message/{message_uuid}/Media/` | done |
| upload_media | POST | `/v1/Account/{auth_id}/Media/` | done |
| list_media | GET | `/v1/Account/{auth_id}/Media/` | done |
| get_media | GET | `/v1/Account/{auth_id}/Media/{media_id}/` | done |
| list_powerpacks | GET | `/v1/Account/{auth_id}/Powerpack/` | done |
| get_powerpack | GET | `/v1/Account/{auth_id}/Powerpack/{uuid}/` | done |
| create_powerpack | POST | `/v1/Account/{auth_id}/Powerpack/` | done |
| update_powerpack | POST | `/v1/Account/{auth_id}/Powerpack/{uuid}/` | done |
| delete_powerpack | DELETE | `/v1/Account/{auth_id}/Powerpack/{uuid}/` | done |
| list_pool_numbers | GET | `/v1/Account/{auth_id}/NumberPool/{pool_uuid}/Number/` | done |
| get_pool_number | GET | `/v1/Account/{auth_id}/NumberPool/{pool_uuid}/Number/{number}/` | done |
| add_pool_number | POST | `/v1/Account/{auth_id}/NumberPool/{pool_uuid}/Number/{number}/` | done |
| buy_pool_number | POST | `/v1/Account/{auth_id}/NumberPool/{pool_uuid}/Number/{number}/` | done |
| remove_pool_number | DELETE | `/v1/Account/{auth_id}/NumberPool/{pool_uuid}/Number/{number}/` | done |
| list_pool_shortcodes | GET | `/v1/Account/{auth_id}/NumberPool/{pool_uuid}/Shortcode/` | done |
| get_pool_shortcode | GET | `/v1/Account/{auth_id}/NumberPool/{pool_uuid}/Shortcode/{shortcode}/` | done |
| remove_pool_shortcode | DELETE | `/v1/Account/{auth_id}/NumberPool/{pool_uuid}/Shortcode/{shortcode}/` | done |
| list_pool_tollfree | GET | `/v1/Account/{auth_id}/NumberPool/{pool_uuid}/Tollfree/` | done |
| get_pool_tollfree | GET | `/v1/Account/{auth_id}/NumberPool/{pool_uuid}/Tollfree/{tollfree}/` | done |
| add_pool_tollfree | POST | `/v1/Account/{auth_id}/NumberPool/{pool_uuid}/Tollfree/{tollfree}/` | done |
| remove_pool_tollfree | DELETE | `/v1/Account/{auth_id}/NumberPool/{pool_uuid}/Tollfree/{tollfree}/` | done |
| list_whatsapp_templates | GET | `/v1/Account/{auth_id}/WhatsApp/Template/{waba_id}/` | done |
| get_whatsapp_template | GET | `/v1/Account/{auth_id}/WhatsApp/Template/{waba_id}/{template_id}/` | done |
| create_whatsapp_template | POST | `/v1/Account/{auth_id}/WhatsApp/Template/{waba_id}/` | done |
| update_whatsapp_template | POST | `/v1/Account/{auth_id}/WhatsApp/Template/{waba_id}/{template_id}/` | done |
| delete_whatsapp_template | DELETE | `/v1/Account/{auth_id}/WhatsApp/Template/{waba_id}/{template_id}/` | done |
| list_profiles | GET | `/v1/Account/{auth_id}/Profile/` | done |
| get_profile | GET | `/v1/Account/{auth_id}/Profile/{profile_uuid}/` | done |
| create_profile | POST | `/v1/Account/{auth_id}/Profile/` | done |
| update_profile | POST | `/v1/Account/{auth_id}/Profile/{profile_uuid}/` | done |
| delete_profile | DELETE | `/v1/Account/{auth_id}/Profile/{profile_uuid}/` | done |
| list_brands | GET | `/v1/Account/{auth_id}/10dlc/Brand/` | done |
| get_brand | GET | `/v1/Account/{auth_id}/10dlc/Brand/{brand_id}/` | done |
| create_brand | POST | `/v1/Account/{auth_id}/10dlc/Brand/` | done |
| delete_brand | DELETE | `/v1/Account/{auth_id}/10dlc/Brand/{brand_id}/` | done |
| get_brand_usecases | GET | `/v1/Account/{auth_id}/10dlc/Brand/{brand_id}/usecases/` | done |
| resend_brand_otp | POST | `/v1/Account/{auth_id}/10dlc/Brand/{brand_id}/OTP/` | done |
| list_campaigns | GET | `/v1/Account/{auth_id}/10dlc/Campaign/` | done |
| get_campaign | GET | `/v1/Account/{auth_id}/10dlc/Campaign/{campaign_id}/` | done |
| create_campaign | POST | `/v1/Account/{auth_id}/10dlc/Campaign/` | done |
| update_campaign | POST | `/v1/Account/{auth_id}/10dlc/Campaign/{campaign_id}/` | done |
| delete_campaign | DELETE | `/v1/Account/{auth_id}/10dlc/Campaign/{campaign_id}/` | done |
| import_campaign | POST | `/v1/Account/{auth_id}/10dlc/Campaign/Import/` | done |
| link_campaign_numbers | POST | `/v1/Account/{auth_id}/10dlc/Campaign/{campaign_id}/Number/` | done |
| list_campaign_numbers | GET | `/v1/Account/{auth_id}/10dlc/Campaign/{campaign_id}/Number/` | done |
| get_campaign_number | GET | `/v1/Account/{auth_id}/10dlc/Campaign/{campaign_id}/Number/{number}/` | done |
| unlink_campaign_number | DELETE | `/v1/Account/{auth_id}/10dlc/Campaign/{campaign_id}/Number/{number}/` | done |
| list_tollfree_verifications | GET | `/v1/Account/{auth_id}/TollfreeVerification/` | done |
| get_tollfree_verification | GET | `/v1/Account/{auth_id}/TollfreeVerification/{uuid}/` | done |
| create_tollfree_verification | POST | `/v1/Account/{auth_id}/TollfreeVerification/` | done |
| update_tollfree_verification | POST | `/v1/Account/{auth_id}/TollfreeVerification/{uuid}/` | done |
| delete_tollfree_verification | DELETE | `/v1/Account/{auth_id}/TollfreeVerification/{uuid}/` | done |
| list_hosted_messaging_numbers | GET | `/v1/Account/{auth_id}/HostedMessagingNumber/` | done |
| get_hosted_messaging_number | GET | `/v1/Account/{auth_id}/HostedMessagingNumber/{id}/` | done |
| create_hosted_messaging_number | POST | `/v1/Account/{auth_id}/HostedMessagingNumber/` | done |
| list_loas | GET | `/v1/Account/{auth_id}/HostedMessagingNumber/LOA/` | done |
| get_loa | GET | `/v1/Account/{auth_id}/HostedMessagingNumber/LOA/{loa_id}/` | done |
| create_loa | POST | `/v1/Account/{auth_id}/HostedMessagingNumber/LOA/` | done |
| delete_loa | DELETE | `/v1/Account/{auth_id}/HostedMessagingNumber/LOA/{loa_id}/` | done |

### Voice (74)

| Action | Method | Path | Status |
| --- | --- | --- | --- |
| make_call | POST | `/v1/Account/{auth_id}/Call/` | done |
| list_calls | GET | `/v1/Account/{auth_id}/Call/` | done |
| get_call | GET | `/v1/Account/{auth_id}/Call/{call_uuid}/` | done |
| list_live_calls | GET | `/v1/Account/{auth_id}/Call/` | done |
| get_live_call | GET | `/v1/Account/{auth_id}/Call/{call_uuid}/` | done |
| list_queued_calls | GET | `/v1/Account/{auth_id}/Call/` | done |
| get_queued_call | GET | `/v1/Account/{auth_id}/Call/{call_uuid}/` | done |
| transfer_call | POST | `/v1/Account/{auth_id}/Call/{call_uuid}/` | done |
| hangup_call | DELETE | `/v1/Account/{auth_id}/Call/{call_uuid}/` | done |
| cancel_call_request | DELETE | `/v1/Account/{auth_id}/Request/{request_uuid}/` | done |
| start_call_recording | POST | `/v1/Account/{auth_id}/Call/{call_uuid}/Record/` | done |
| stop_call_recording | DELETE | `/v1/Account/{auth_id}/Call/{call_uuid}/Record/` | done |
| start_call_play | POST | `/v1/Account/{auth_id}/Call/{call_uuid}/Play/` | done |
| stop_call_play | DELETE | `/v1/Account/{auth_id}/Call/{call_uuid}/Play/` | done |
| start_call_speak | POST | `/v1/Account/{auth_id}/Call/{call_uuid}/Speak/` | done |
| stop_call_speak | DELETE | `/v1/Account/{auth_id}/Call/{call_uuid}/Speak/` | done |
| send_call_digits | POST | `/v1/Account/{auth_id}/Call/{call_uuid}/DTMF/` | done |
| start_call_stream | POST | `/v1/Account/{auth_id}/Call/{call_uuid}/Stream/` | done |
| list_call_streams | GET | `/v1/Account/{auth_id}/Call/{call_uuid}/Stream/` | done |
| get_call_stream | GET | `/v1/Account/{auth_id}/Call/{call_uuid}/Stream/{stream_id}/` | done |
| stop_call_stream | DELETE | `/v1/Account/{auth_id}/Call/{call_uuid}/Stream/{stream_id}/` | done |
| stop_all_call_streams | DELETE | `/v1/Account/{auth_id}/Call/{call_uuid}/Stream/` | done |
| send_call_feedback | POST | `stats.plivo.com/v1/Call/{call_uuid}/Feedback/` | done |
| list_conferences | GET | `/v1/Account/{auth_id}/Conference/` | done |
| get_conference | GET | `/v1/Account/{auth_id}/Conference/{conference_name}/` | done |
| hangup_conference | DELETE | `/v1/Account/{auth_id}/Conference/{conference_name}/` | done |
| hangup_all_conferences | DELETE | `/v1/Account/{auth_id}/Conference/` | done |
| hangup_conference_member | DELETE | `/v1/Account/{auth_id}/Conference/{conference_name}/Member/{member_id}/` | done |
| kick_conference_member | POST | `/v1/Account/{auth_id}/Conference/{conference_name}/Member/{member_id}/Kick/` | done |
| mute_conference_member | POST | `/v1/Account/{auth_id}/Conference/{conference_name}/Member/{member_id}/Mute/` | done |
| unmute_conference_member | DELETE | `/v1/Account/{auth_id}/Conference/{conference_name}/Member/{member_id}/Mute/` | done |
| deaf_conference_member | POST | `/v1/Account/{auth_id}/Conference/{conference_name}/Member/{member_id}/Deaf/` | done |
| undeaf_conference_member | DELETE | `/v1/Account/{auth_id}/Conference/{conference_name}/Member/{member_id}/Deaf/` | done |
| play_to_conference_member | POST | `/v1/Account/{auth_id}/Conference/{conference_name}/Member/{member_id}/Play/` | done |
| stop_conference_member_play | DELETE | `/v1/Account/{auth_id}/Conference/{conference_name}/Member/{member_id}/Play/` | done |
| speak_to_conference_member | POST | `/v1/Account/{auth_id}/Conference/{conference_name}/Member/{member_id}/Speak/` | done |
| stop_conference_member_speak | DELETE | `/v1/Account/{auth_id}/Conference/{conference_name}/Member/{member_id}/Speak/` | done |
| start_conference_recording | POST | `/v1/Account/{auth_id}/Conference/{conference_name}/Record/` | done |
| stop_conference_recording | DELETE | `/v1/Account/{auth_id}/Conference/{conference_name}/Record/` | done |
| list_mpcs | GET | `/v1/Account/{auth_id}/MultiPartyCall/` | done |
| get_mpc | GET | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/` | done |
| start_mpc | POST | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/` | done |
| end_mpc | DELETE | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/` | done |
| add_mpc_participant | POST | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Participant/` | done |
| list_mpc_participants | GET | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Participant/` | done |
| get_mpc_participant | GET | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Participant/{participant_id}/` | done |
| update_mpc_participant | POST | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Participant/{participant_id}/` | done |
| kick_mpc_participant | DELETE | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Participant/{participant_id}/` | done |
| start_mpc_recording | POST | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Record/` | done |
| stop_mpc_recording | DELETE | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Record/` | done |
| pause_mpc_recording | POST | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Record/Pause/` | done |
| resume_mpc_recording | POST | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Record/Resume/` | done |
| start_mpc_participant_recording | POST | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Participant/{participant_id}/Record/` | done |
| stop_mpc_participant_recording | DELETE | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Participant/{participant_id}/Record/` | done |
| pause_mpc_participant_recording | POST | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Participant/{participant_id}/Record/Pause/` | done |
| resume_mpc_participant_recording | POST | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Participant/{participant_id}/Record/Resume/` | done |
| start_mpc_member_play | POST | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Member/{participant_id}/Play/` | done |
| stop_mpc_member_play | DELETE | `/v1/Account/{auth_id}/MultiPartyCall/{mpc}/Member/{participant_id}/Play/` | done |
| list_recordings | GET | `/v1/Account/{auth_id}/Recording/` | done |
| get_recording | GET | `/v1/Account/{auth_id}/Recording/{recording_id}/` | done |
| delete_recording | DELETE | `/v1/Account/{auth_id}/Recording/{recording_id}/` | done |
| create_transcription | POST | `/v1/Account/{auth_id}/Transcription/{recording_id}/` | done |
| get_transcription | GET | `/v1/Account/{auth_id}/Transcription/{transcription_id}/` | done |
| delete_transcription | DELETE | `/v1/Account/{auth_id}/Transcription/{transcription_id}/` | done |
| list_masking_sessions | GET | `/v1/Account/{auth_id}/Masking/Session/` | done |
| get_masking_session | GET | `/v1/Account/{auth_id}/Masking/Session/{session_uuid}/` | done |
| create_masking_session | POST | `/v1/Account/{auth_id}/Masking/Session/` | done |
| update_masking_session | POST | `/v1/Account/{auth_id}/Masking/Session/{session_uuid}/` | done |
| delete_masking_session | DELETE | `/v1/Account/{auth_id}/Masking/Session/{session_uuid}/` | done |
| get_phlo | GET | `phlorunner.plivo.com/v1/phlo/{phlo_id}/` | done |
| run_phlo | POST | `phlorunner.plivo.com/v1/account/{auth_id}/phlo/{phlo_id}/` | done |
| get_phlo_node | GET | `phlorunner.plivo.com/v1/phlo/{phlo_id}/{node_type}/{node_id}/` | done |
| phlo_node_action | POST | `phlorunner.plivo.com/v1/phlo/{phlo_id}/{node_type}/{node_id}/` | done |
| phlo_member_action | POST | `phlorunner.plivo.com/v1/phlo/{phlo_id}/{node_type}/{node_id}/members/{member_id}/` | done |

### Numbers, lookup, Verify, compliance (55)

| Action | Method | Path | Status |
| --- | --- | --- | --- |
| search_phone_numbers | GET | `/v1/Account/{auth_id}/PhoneNumber/` | done |
| buy_phone_number | POST | `/v1/Account/{auth_id}/PhoneNumber/{number}/` | done |
| list_numbers | GET | `/v1/Account/{auth_id}/Number/` | done |
| get_number | GET | `/v1/Account/{auth_id}/Number/{number}/` | done |
| update_number | POST | `/v1/Account/{auth_id}/Number/{number}/` | done |
| unrent_number | DELETE | `/v1/Account/{auth_id}/Number/{number}/` | done |
| add_carrier_numbers | POST | `/v1/Account/{auth_id}/Number/` | done |
| lookup_number | GET | `lookup.plivo.com/v1/Number/{number}` | done |
| create_verify_session | POST | `/v1/Account/{auth_id}/Verify/Session/` | done |
| validate_verify_session | POST | `/v1/Account/{auth_id}/Verify/Session/{session_uuid}/` | done |
| get_verify_session | GET | `/v1/Account/{auth_id}/Verify/Session/{session_uuid}/` | done |
| list_verify_sessions | GET | `/v1/Account/{auth_id}/Verify/Session/` | done |
| start_caller_id_verification | POST | `/v1/Account/{auth_id}/VerifiedCallerId/` | done |
| complete_caller_id_verification | POST | `/v1/Account/{auth_id}/VerifiedCallerId/Verification/{verification_uuid}/` | done |
| list_verified_caller_ids | GET | `/v1/Account/{auth_id}/VerifiedCallerId/` | done |
| get_verified_caller_id | GET | `/v1/Account/{auth_id}/VerifiedCallerId/{phone_number}/` | done |
| update_verified_caller_id | POST | `/v1/Account/{auth_id}/VerifiedCallerId/{phone_number}/` | done |
| delete_verified_caller_id | DELETE | `/v1/Account/{auth_id}/VerifiedCallerId/{phone_number}/` | done |
| get_number_compliance_requirements | GET | `/v1/Account/{auth_id}/PhoneNumber/Compliance/Requirements/` | done |
| list_number_compliance | GET | `/v1/Account/{auth_id}/PhoneNumber/Compliance/` | done |
| get_number_compliance | GET | `/v1/Account/{auth_id}/PhoneNumber/Compliance/{compliance_id}/` | done |
| create_number_compliance | POST | `/v1/Account/{auth_id}/PhoneNumber/Compliance/` | done |
| update_number_compliance | PATCH | `/v1/Account/{auth_id}/PhoneNumber/Compliance/{compliance_id}/` | done |
| delete_number_compliance | DELETE | `/v1/Account/{auth_id}/PhoneNumber/Compliance/{compliance_id}/` | done |
| link_number_compliance | POST | `/v1/Account/{auth_id}/PhoneNumber/Compliance/Link/` | done |
| list_end_users | GET | `/v1/Account/{auth_id}/EndUser/` | done |
| get_end_user | GET | `/v1/Account/{auth_id}/EndUser/{end_user_id}/` | done |
| create_end_user | POST | `/v1/Account/{auth_id}/EndUser/` | done |
| update_end_user | POST | `/v1/Account/{auth_id}/EndUser/{end_user_id}/` | done |
| delete_end_user | DELETE | `/v1/Account/{auth_id}/EndUser/{end_user_id}/` | done |
| list_compliance_document_types | GET | `/v1/Account/{auth_id}/ComplianceDocumentType/` | done |
| get_compliance_document_type | GET | `/v1/Account/{auth_id}/ComplianceDocumentType/{document_type_id}/` | done |
| list_compliance_documents | GET | `/v1/Account/{auth_id}/ComplianceDocument/` | done |
| get_compliance_document | GET | `/v1/Account/{auth_id}/ComplianceDocument/{compliance_document_id}/` | done |
| create_compliance_document | POST | `/v1/Account/{auth_id}/ComplianceDocument/` | done |
| update_compliance_document | POST | `/v1/Account/{auth_id}/ComplianceDocument/{compliance_document_id}/` | done |
| delete_compliance_document | DELETE | `/v1/Account/{auth_id}/ComplianceDocument/{compliance_document_id}/` | done |
| list_compliance_requirements | GET | `/v1/Account/{auth_id}/ComplianceRequirement/` | done |
| get_compliance_requirement | GET | `/v1/Account/{auth_id}/ComplianceRequirement/{compliance_requirement_id}/` | done |
| list_compliance_applications | GET | `/v1/Account/{auth_id}/ComplianceApplication/` | done |
| get_compliance_application | GET | `/v1/Account/{auth_id}/ComplianceApplication/{compliance_application_id}/` | done |
| create_compliance_application | POST | `/v1/Account/{auth_id}/ComplianceApplication/` | done |
| update_compliance_application | POST | `/v1/Account/{auth_id}/ComplianceApplication/{compliance_application_id}/` | done |
| delete_compliance_application | DELETE | `/v1/Account/{auth_id}/ComplianceApplication/{compliance_application_id}/` | done |
| submit_compliance_application | POST | `/v1/Account/{auth_id}/ComplianceApplication/{compliance_application_id}/Submit/` | done |
| list_addresses | GET | `/v1/Account/{auth_id}/Verification/Address/` | done |
| get_address | GET | `/v1/Account/{auth_id}/Verification/Address/{address_id}/` | done |
| create_address | POST | `/v1/Account/{auth_id}/Verification/Address/` | done |
| update_address | POST | `/v1/Account/{auth_id}/Verification/Address/{address_id}/` | done |
| delete_address | DELETE | `/v1/Account/{auth_id}/Verification/Address/{address_id}/` | done |
| list_identities | GET | `/v1/Account/{auth_id}/Verification/Identity/` | done |
| get_identity | GET | `/v1/Account/{auth_id}/Verification/Identity/{identity_id}/` | done |
| create_identity | POST | `/v1/Account/{auth_id}/Verification/Identity/` | done |
| update_identity | POST | `/v1/Account/{auth_id}/Verification/Identity/{identity_id}/` | done |
| delete_identity | DELETE | `/v1/Account/{auth_id}/Verification/Identity/{identity_id}/` | done |

### Zentrunk SIP trunking (23)

| Action | Method | Path | Status |
| --- | --- | --- | --- |
| list_trunks | GET | `/v1/Account/{auth_id}/Zentrunk/Trunk/` | done |
| get_trunk | GET | `/v1/Account/{auth_id}/Zentrunk/Trunk/{trunk_id}/` | done |
| create_trunk | POST | `/v1/Account/{auth_id}/Zentrunk/Trunk/` | done |
| update_trunk | POST | `/v1/Account/{auth_id}/Zentrunk/Trunk/{trunk_id}/` | done |
| delete_trunk | DELETE | `/v1/Account/{auth_id}/Zentrunk/Trunk/{trunk_id}/` | done |
| list_trunk_credentials | GET | `/v1/Account/{auth_id}/Zentrunk/Credential/` | done |
| get_trunk_credential | GET | `/v1/Account/{auth_id}/Zentrunk/Credential/{credential_uuid}/` | done |
| create_trunk_credential | POST | `/v1/Account/{auth_id}/Zentrunk/Credential/` | done |
| update_trunk_credential | POST | `/v1/Account/{auth_id}/Zentrunk/Credential/{credential_uuid}/` | done |
| delete_trunk_credential | DELETE | `/v1/Account/{auth_id}/Zentrunk/Credential/{credential_uuid}/` | done |
| list_trunk_ip_lists | GET | `/v1/Account/{auth_id}/Zentrunk/IPAccessControlList/` | done |
| get_trunk_ip_list | GET | `/v1/Account/{auth_id}/Zentrunk/IPAccessControlList/{ipacl_uuid}/` | done |
| create_trunk_ip_list | POST | `/v1/Account/{auth_id}/Zentrunk/IPAccessControlList/` | done |
| update_trunk_ip_list | POST | `/v1/Account/{auth_id}/Zentrunk/IPAccessControlList/{ipacl_uuid}/` | done |
| delete_trunk_ip_list | DELETE | `/v1/Account/{auth_id}/Zentrunk/IPAccessControlList/{ipacl_uuid}/` | done |
| list_trunk_uris | GET | `/v1/Account/{auth_id}/Zentrunk/URI/` | done |
| get_trunk_uri | GET | `/v1/Account/{auth_id}/Zentrunk/URI/{uri_uuid}/` | done |
| create_trunk_uri | POST | `/v1/Account/{auth_id}/Zentrunk/URI/` | done |
| update_trunk_uri | POST | `/v1/Account/{auth_id}/Zentrunk/URI/{uri_uuid}/` | done |
| delete_trunk_uri | DELETE | `/v1/Account/{auth_id}/Zentrunk/URI/{uri_uuid}/` | done |
| list_trunk_calls | GET | `/v1/Account/{auth_id}/Zentrunk/Call/` | done |
| get_trunk_call | GET | `/v1/Account/{auth_id}/Zentrunk/Call/{call_uuid}/` | done |
| get_trunk_call_insights | GET | `/v1/Account/{auth_id}/Zentrunk/Call/{call_uuid}/Insights/` | done |
