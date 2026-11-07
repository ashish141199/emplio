# MSG91 coverage

Sources, swept 26 Oct 2026: MSG91's docs (docs.msg91.com/llms.txt and its sitemap; every endpoint page has an
OpenAPI file, 126 operations in all), Context7's copy of the same docs, MSG91's GitHub (MSG91/*, the
Walkover-Web-Solution WhatsApp SDKs, MSG91-node) and a GitHub code search for other v5 paths. n8n's MSG91 node
only sends a legacy SMS. Nothing outside the docs turned up except the old SMS balance call.

The 126 documented operations make 108 actions: the 10 "RCS send" pages are one call (`send-rcs-message/bulk/`)
with a different `function_name`, so they are `send_rcs_message` plus `send_rcs_template`; the 10 "RCS create
template" pages are `create_rcs_template`; "Send Email" and "Sending Emails Using Handlebars" (and the CSV send
example) are `send_email`. One undocumented pre-v5 call, the SMS balance (`/api/balance.php`, still used by
MSG91's own MSG91-node SDK), adds `get_sms_balance`: 109 actions.

Hosts: `control` is https://control.msg91.com/api/v5, `api` is https://api.msg91.com/api/v5 (where MSG91
documents WhatsApp groups, template creation and the OTP widget). The key goes in the `authkey` header, except
the two PHP calls (balance, sub-accounts), which take it as `?authkey=`.

## Errors

MSG91 answers many failures with a 200. `failed` in client.ts turns each shape into an error:
`{"type": "error", "message"}` (SMS, OTP), `{"hasError": true, "errors"}` / `{"status": "fail" | "error"}`
(WhatsApp, RCS, templates), `{"success": false}` (Hello), `{"error": "…"}` (reports: bad dates, range too long),
`{"msgType" | "msg_type": "error"}` (PHP calls). A 401 marks the key for reconnecting. `check` asks for today's
SMS analytics: free, on every account.

## Not covered

| What | Why |
| --- | --- |
| Legacy `sendhttp.php` / `api/v2/sendsms` | Gone from MSG91's docs; Indian SMS now needs a DLT template, which `send_sms` (flow) carries. |
| DLT (entity, headers, template registration) | Done on the operators' DLT portals, not through MSG91's API; the DLT template id is a field on `add_sms_template`, `add_sms_template_version`, `edit_otp_template`. |
| Short URL service on its own | No documented endpoint; links are shortened and tracked through `send_sms`'s `short_url` and `create_rcs_template`'s `click_count`. |
| SMS / email / WhatsApp template listing beyond what's here, email template update/delete, email domains, WhatsApp media upload | Not in MSG91's API docs or SDKs; the panel does them. Media is sent by public link (`attachment_url`, `media_url`, header links). |
| Campaign list / logs, phonebook and segment CRUD | Not documented; campaigns run by slug (`run_campaign`, `run_campaign_on_segment`), phonebooks are made in the panel. |
| Webhooks (delivery reports, inbound WhatsApp/SMS, Hello events) | Set up in the panel, no API to register them; own apps have no triggers yet. `callback_url` on voice calls is passed through. |
| Wallet top-up / invoices | No API. Balances: `get_sms_balance`, `whatsapp_prepaid_balance`. |
| Push notifications, Numbers, KnowledgeBase, File hosting | Products with no API in the docs. |
| M91 alerts (MSG91/m91-sdk) | A separate product authenticated by a per-channel send link, not the Auth Key. |

## Notes on the docs

- `send_whatsapp_message`: the docs show only the text form (`content_type: text`, `text`); the media, location
  and reaction fields are listed for the agent and the input is `.loose()` so whatever MSG91 takes gets through.
- RCS "Open Url" is documented on `/rcs/send-rcs-message/` while the other nine shapes use `/bulk/`; all go to `/bulk/`.
- Voice files list says `auth_key` header; the `authkey` header every other call uses is sent.
- Join requests list is documented with `?authkey=`; the header is sent instead, like every other call.
- Hello "Get Save Filter list by Filter ID" is printed as `/saved-filter/fitlerId`; the id goes there (`{filter_id}`).
- Hello WhatsApp draft create is printed `/hello//draft/…`; sent with one slash.
- `update_whatsapp_group` documents `authkey` as a form field too; it travels as the header.

## Actions

### SMS (8)

| Action | Endpoint | Host | Asks first | Status |
| --- | --- | --- | --- | --- |
| send_sms | POST /flow | control | yes | done |
| add_sms_template | POST /sms/addTemplate | control | yes | done |
| add_sms_template_version | POST /sms/addTemplateVersion | control | yes | done |
| get_sms_template_versions | POST /sms/getTemplateVersions | control |  | done |
| mark_sms_template_version_default | GET /sms/markActive | control | yes | done |
| sms_logs | POST /report/logs/p/sms | control |  | done |
| sms_analytics | GET /report/analytics/p/sms | control |  | done |
| get_sms_balance | GET /balance.php | control (/api, key in query) |  | done |

### OTP and OTP widget (12)

| Action | Endpoint | Host | Asks first | Status |
| --- | --- | --- | --- | --- |
| send_otp | POST /otp | control | yes | done |
| verify_otp | GET /otp/verify | control |  | done |
| resend_otp | GET /otp/retry | control | yes | done |
| edit_otp_template | POST /otp/updateOtpTemplate | control | yes | done |
| otp_logs | GET /report/logs/p/otp | control |  | done |
| otp_analytics | GET /report/analytics/p/otp | control |  | done |
| widget_send_otp | POST /widget/sendOtp | api | yes | done |
| widget_retry_otp | POST /widget/retryOtp | api | yes | done |
| widget_verify_otp | POST /widget/verifyOtp | api | yes | done |
| verify_access_token | POST /widget/verifyAccessToken | api |  | done |
| widget_logs | GET /report/logs/p/widget | control |  | done |
| widget_analytics | GET /report/analytics/p/widget | control |  | done |

### WhatsApp (29)

| Action | Endpoint | Host | Asks first | Status |
| --- | --- | --- | --- | --- |
| list_whatsapp_numbers | GET /whatsapp/whatsapp-activation/ | control |  | done |
| list_whatsapp_templates | GET /whatsapp/get-template-client/{number} | control |  | done |
| create_whatsapp_template | POST /whatsapp/client-panel-template/ | api | yes | done |
| edit_whatsapp_template | PUT /whatsapp/client-panel-template/{template_id}/ | control | yes | done |
| delete_whatsapp_template | DELETE /whatsapp/client-panel-template/ | control | yes | done |
| send_whatsapp_template | POST /whatsapp/whatsapp-outbound-message/bulk/ | control | yes | done |
| send_whatsapp_message | POST /whatsapp/whatsapp-outbound-message/ | control | yes | done |
| send_whatsapp_buttons | POST /whatsapp/whatsapp-outbound-message/ | control | yes | done |
| send_whatsapp_list | POST /whatsapp/whatsapp-outbound-message/ | control | yes | done |
| request_whatsapp_location | POST /whatsapp/whatsapp-outbound-message/ | control | yes | done |
| send_whatsapp_product | POST /whatsapp/whatsapp-outbound-message/ | control | yes | done |
| send_whatsapp_product_list | POST /whatsapp/whatsapp-outbound-message/ | control | yes | done |
| send_whatsapp_payment_link | POST /whatsapp/whatsapp-outbound-message/ | api | yes | done |
| send_whatsapp_typing | POST /whatsapp/typing-indicator/ | api | yes | done |
| whatsapp_prepaid_balance | POST /subscriptions/fetchPrepaidBalance | control |  | done |
| update_whatsapp_call_settings | POST /whatsapp/integrated-number/call-settings/ | control | yes | done |
| list_whatsapp_groups | GET /whatsapp/groups/ | api |  | done |
| get_whatsapp_group | GET /whatsapp/groups/{group_id}/ | api |  | done |
| create_whatsapp_group | POST /whatsapp/groups/ | api | yes | done |
| update_whatsapp_group | PUT /whatsapp/groups/{group_id}/ (multipart) | api | yes | done; the docs print /groups/ with no group id, we put it in the path like every other per-group call |
| reset_whatsapp_group_link | PATCH /whatsapp/groups/{group_id}/ | api | yes | done |
| delete_whatsapp_group | DELETE /whatsapp/groups/{group_id}/ | api | yes | done |
| remove_whatsapp_group_participants | DELETE /whatsapp/groups/{group_id}/ | api | yes | done |
| list_whatsapp_group_join_requests | GET /whatsapp/groups/{group_id}/join_req | api |  | done |
| approve_whatsapp_group_join_requests | POST /whatsapp/groups/{group_id}/join_requests | api | yes | done |
| reject_whatsapp_group_join_requests | DELETE /whatsapp/groups/{group_id}/join_requests | api | yes | done |
| send_whatsapp_group_message | POST /whatsapp/whatsapp-outbound-message/ | api | yes | done |
| whatsapp_logs | GET /report/logs/wa | control |  | done |
| whatsapp_analytics | GET /report/analytics/p/wa/ | control |  | done |

### Email (8)

| Action | Endpoint | Host | Asks first | Status |
| --- | --- | --- | --- | --- |
| send_email | POST /email/send | control | yes | done |
| validate_email | POST /email/validate | control |  | done |
| list_email_templates | GET /email/templates | control |  | done |
| get_email_template_version | GET /email/template-versions/{version_id} | control |  | done |
| create_email_template | POST /email/templates | control | yes | done |
| inline_email_css | POST /email/services/inline-css | control |  | done |
| email_logs | GET /report/logs/mail | control |  | done |
| email_analytics | GET /report/analytics/p/mail | control |  | done |

### Voice (13)

| Action | Endpoint | Host | Asks first | Status |
| --- | --- | --- | --- | --- |
| send_voice_message | POST /voice/call/ | control | yes | done |
| run_voice_flow | POST /voice/call/ | control | yes | done |
| click_to_call | POST /voice/call/ctc | control | yes | done |
| list_voice_templates | GET /voice/templates/ | control |  | done |
| create_voice_template | POST /voice/templates/ | control | yes | done |
| list_voice_files | GET /voice/files | control |  | done |
| list_voice_agents | GET /voice/company-agent-list/ | control |  | done |
| get_sip_credentials | GET /voice/public/sip-credentials/ | control | yes | done |
| get_vpn_credentials | GET /voice/public/vpn-credentials/ | control | yes | done |
| voice_call_logs | GET /voice/call-logs/ | control |  | done |
| get_call_recording | GET /voice/call-recording/{uuid} | control |  | done |
| voice_logs | GET /report/logs/voice | control |  | done |
| voice_analytics | GET /report/analytics/p/voice | control |  | done |

### RCS (6)

| Action | Endpoint | Host | Asks first | Status |
| --- | --- | --- | --- | --- |
| send_rcs_message | POST /rcs/send-rcs-message/bulk/ | control | yes | done |
| send_rcs_template | POST /rcs/send-rcs-message/bulk/ | control | yes | done |
| create_rcs_template | POST /rcs/rcs-client-panel/template/ | control | yes | done |
| list_rcs_templates | GET /rcs/rcs-client-panel/template/ | control |  | done |
| rcs_logs | GET /report/logs/rcs | control |  | done |
| rcs_analytics | GET /report/analytics/rcs | control |  | done |

### Segmento (contacts and events) (9)

| Action | Endpoint | Host | Asks first | Status |
| --- | --- | --- | --- | --- |
| get_phonebook_fields | GET /segmento/api/v1/phonebooks/{phonebook_id}/fields | control |  | done |
| upsert_contact | POST /segmento/api/v1/phonebooks/{phonebook_id}/contacts | control | yes | done |
| search_contacts | POST /segmento/api/v1/phonebooks/{phonebook_id}/contacts/filters | control |  | done |
| delete_contacts | DELETE /segmento/api/v1/phonebooks/{phonebook_id}/contacts | control | yes | done |
| track_events | POST /segmento/api/v1/event/{phonebook_id} | control | yes | done |
| get_user_journey | POST /segmento/api/v1/userEvents/{phonebook_id} | control |  | done |
| list_event_types | GET /segmento/api/v1/eventTypes/{phonebook_id} | control |  | done |
| list_failed_events | POST /segmento/api/v1/failedEvents/{phonebook_id} | control |  | done |
| get_product_catalog | GET /segmento/api/v1/products/{phonebook_id} | control |  | done |

### Campaigns, OneAPI, sub-accounts (4)

| Action | Endpoint | Host | Asks first | Status |
| --- | --- | --- | --- | --- |
| run_campaign | POST /campaign/api/campaigns/{campaign_slug}/run | control | yes | done |
| run_campaign_on_segment | POST /segmento/api/v1/phonebooks/{phonebook_id}/communications/api | control | yes | done |
| run_oneapi_flow | POST /oneapi/api/flow/{oneapi_slug}/run | control | yes | done |
| add_subaccount | GET /add_client.php | control (/api, key in query) | yes | done |

### Hello (help desk) (20)

| Action | Endpoint | Host | Asks first | Status |
| --- | --- | --- | --- | --- |
| list_hello_inboxes | GET /hello/v2/inbox/all/ | control |  | done |
| list_hello_inbox_participants | GET /hello/inboxes/{inbox_id}/participants | control |  | done |
| list_hello_tickets | GET /hello/tickets/tickets/ | control |  | done |
| list_hello_mail_tickets | GET /hello/v2/mail-channel/ | control |  | done |
| send_hello_mail | POST /hello/v2/send/ | control | yes | done |
| set_hello_ticket_closed | PUT /hello/v2/mail-channel/{id} | control | yes | done |
| change_hello_ticket_state | DELETE /hello/v2/mail-channel/ | control | yes | done |
| close_hello_tickets | DELETE /hello/v2/mail-channel/ | control | yes | done |
| close_hello_tickets_by_filter | DELETE /hello/v2/mail-channel/ | control | yes | done |
| assign_hello_tickets | PUT /hello/ticket-assign/ | control | yes | done |
| list_hello_saved_filters | GET /hello/saved-filter/ | control |  | done |
| get_hello_saved_filter | GET /hello/saved-filter/{filter_id} | control |  | done |
| get_hello_drafts | GET /hello/v2/draft/{origin}/{chat_id}/ | control |  | done |
| create_hello_chat_draft | POST /hello/draft/whatsapp/{chat_id}/ | control | yes | done |
| update_hello_chat_draft | PUT /hello/draft/whatsapp/{chat_id}/{draft_id}/ | control | yes | done |
| delete_hello_chat_draft | DELETE /hello/whatsapp/{chat_id}/{draft_id} | control | yes | done |
| create_hello_mail_draft | POST /hello/draft/mail/{chat_id}/ | control | yes | done |
| update_hello_mail_draft | PUT /hello/draft/mail/{chat_id}/{draft_id}/ | control | yes | done |
| delete_hello_mail_draft | DELETE /hello/mail/{chat_id}/{draft_id} | control | yes | done |
| hello_bot_analytics | GET /report/analytics/bot | control |  | done |
