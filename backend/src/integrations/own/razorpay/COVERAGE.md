# Razorpay coverage

Source: `tools/businessos/server/src/integrations/razorpay`, itself swept from the official `razorpay/razorpay-node` SDK and Razorpay's docs on 2026-08-28. Razorpay publishes no OpenAPI spec. n8n node: none. Converted to `actions.json` once on 2026-11-05; edit that file by hand from here.

143 actions, 53 triggers, 1 login method.

## Actions

| Group | Call | Action | Status |
| --- | --- | --- | --- |
| Orders | POST /v1/orders | create_order | done |
| Orders | GET /v1/orders | list_orders | done |
| Orders | GET /v1/orders/{order_id} | get_order | done |
| Orders | PATCH /v1/orders/{order_id} | update_order_notes | done |
| Orders | GET /v1/orders/{order_id}/payments | list_payments_for_order | done |
| Orders | GET /v1/orders/{order_id}?expand[]=transfers | get_order_with_transfers | done |
| Orders | POST /v1/orders/{order_id}/rto_review | get_rto_risk_review | done |
| Orders | POST /v1/orders/{order_id}/fulfillment | update_fulfillment | done |
| Payments | GET /v1/payments | list_payments | done |
| Payments | GET /v1/payments/{payment_id} | get_payment | done |
| Payments | POST /v1/payments/{payment_id}/capture | capture_payment | done |
| Payments | PATCH /v1/payments/{payment_id} | update_payment_notes | done |
| Payments | GET /v1/payments/{payment_id}/card | get_card_used_for_payment | done |
| Payments | GET /v1/payments/{payment_id}/bank_transfer | get_bank_transfer_details | done |
| Payments | GET /v1/methods | list_enabled_payment_methods | done |
| Payments | GET /v1/payments/downtimes | list_payment_downtimes | done |
| Payments | GET /v1/payments/downtimes/{downtime_id} | get_payment_downtime | done |
| Payments | POST /v1/payments/create/json | create_payment_s2s | done |
| Payments | POST /v1/payments/create/upi | create_upi_payment | done |
| Payments | POST /v1/payments/create/recurring | create_recurring_charge | done |
| Payments | POST /v1/payments/validate/vpa | validate_upi_id | done |
| Payments | POST /v1/payments/{payment_id}/otp_generate | generate_otp | done |
| Payments | POST /v1/payments/{payment_id}/otp/submit | submit_otp | done |
| Payments | POST /v1/payments/{payment_id}/otp/resend | resend_otp | done |
| Payments | GET /v1/cards/{card_id} | get_card | done |
| Payments | POST /v1/cards/fingerprints | get_card_fingerprint | done |
| Payments | GET /v1/iins/{iin} | get_card_iin_details | done |
| Payments | GET /v1/iins/list | list_supported_iins | done |
| Refunds | POST /v1/payments/{payment_id}/refund | create_refund | done |
| Refunds | GET /v1/refunds | list_refunds | done |
| Refunds | GET /v1/refunds/{refund_id} | get_refund | done |
| Refunds | PATCH /v1/refunds/{refund_id} | update_refund_notes | done |
| Refunds | GET /v1/payments/{payment_id}/refunds | list_refunds_for_payment | done |
| Refunds | GET /v1/payments/{payment_id}/refunds/{refund_id} | get_refund_for_payment | done |
| Settlements | GET /v1/settlements | list_settlements | done |
| Settlements | GET /v1/settlements/{settlement_id} | get_settlement | done |
| Settlements | GET /v1/settlements/recon/combined | get_settlement_report | done |
| Settlements | POST /v1/settlements/ondemand | create_instant_settlement | done |
| Settlements | GET /v1/settlements/ondemand | list_instant_settlements | done |
| Settlements | GET /v1/settlements/ondemand/{settlement_id} | get_instant_settlement | done |
| Customers | POST /v1/customers | create_customer | done |
| Customers | GET /v1/customers | list_customers | done |
| Customers | GET /v1/customers/{customer_id} | get_customer | done |
| Customers | PUT /v1/customers/{customer_id} | update_customer | done |
| Customer instruments | GET /v1/customers/{customer_id}/tokens | list_saved_instruments | done |
| Customer instruments | GET /v1/customers/{customer_id}/tokens/{token_id} | get_saved_instrument | done |
| Customer instruments | DELETE /v1/customers/{customer_id}/tokens/{token_id} | delete_saved_instrument | done |
| Customer instruments | POST /v1/tokens/fetch | fetch_token_by_id | done |
| Customer instruments | POST /v1/tokens/delete | delete_token_by_id | done |
| Customer instruments | POST /v1/customers/{customer_id}/bank_account | add_bank_account | done |
| Customer instruments | DELETE /v1/customers/{customer_id}/bank_account/{bank_account_id} | delete_bank_account | done |
| Customer instruments | POST /v1/fund_accounts | create_fund_account | done |
| Customer instruments | GET /v1/fund_accounts | list_fund_accounts | done |
| Customer instruments | POST /v1/customers/eligibility | check_offer_eligibility | done |
| Customer instruments | GET /v1/customers/eligibility/{eligibility_id} | get_offer_eligibility | done |
| Invoices | POST /v1/invoices | create_invoice | done |
| Invoices | GET /v1/invoices | list_invoices | done |
| Invoices | GET /v1/invoices/{invoice_id} | get_invoice | done |
| Invoices | PATCH /v1/invoices/{invoice_id} | update_invoice | done |
| Invoices | POST /v1/invoices/{invoice_id}/issue | issue_invoice | done |
| Invoices | POST /v1/invoices/{invoice_id}/cancel | cancel_invoice | done |
| Invoices | DELETE /v1/invoices/{invoice_id} | delete_draft_invoice | done |
| Invoices | POST /v1/invoices/{invoice_id}/notify_by/{medium} | send_invoice_reminder | done |
| Items | POST /v1/items | create_item | done |
| Items | GET /v1/items | list_items | done |
| Items | GET /v1/items/{item_id} | get_item | done |
| Items | PATCH /v1/items/{item_id} | update_item | done |
| Items | DELETE /v1/items/{item_id} | delete_item | done |
| Payment links | POST /v1/payment_links | create_payment_link | done |
| Payment links | GET /v1/payment_links | list_payment_links | done |
| Payment links | GET /v1/payment_links/{payment_link_id} | get_payment_link | done |
| Payment links | PATCH /v1/payment_links/{payment_link_id} | update_payment_link | done |
| Payment links | POST /v1/payment_links/{payment_link_id}/cancel | cancel_payment_link | done |
| Payment links | POST /v1/payment_links/{payment_link_id}/notify_by/{medium} | send_payment_link_reminder | done |
| Plans | POST /v1/plans | create_plan | done |
| Plans | GET /v1/plans | list_plans | done |
| Plans | GET /v1/plans/{plan_id} | get_plan | done |
| Subscriptions | POST /v1/subscriptions | create_subscription | done |
| Subscriptions | GET /v1/subscriptions | list_subscriptions | done |
| Subscriptions | GET /v1/subscriptions/{subscription_id} | get_subscription | done |
| Subscriptions | PATCH /v1/subscriptions/{subscription_id} | update_subscription | done |
| Subscriptions | GET /v1/subscriptions/{subscription_id}/retrieve_scheduled_changes | get_scheduled_changes | done |
| Subscriptions | POST /v1/subscriptions/{subscription_id}/cancel_scheduled_changes | cancel_scheduled_changes | done |
| Subscriptions | POST /v1/subscriptions/{subscription_id}/pause | pause_subscription | done |
| Subscriptions | POST /v1/subscriptions/{subscription_id}/resume | resume_subscription | done |
| Subscriptions | POST /v1/subscriptions/{subscription_id}/cancel | cancel_subscription | done |
| Subscriptions | DELETE /v1/subscriptions/{subscription_id}/{offer_id} | remove_offer_from_subscription | done |
| Subscriptions | POST /v1/subscription_registration/auth_links | create_mandate_authorisation_link | done |
| Add-ons | POST /v1/subscriptions/{subscription_id}/addons | create_add_on | done |
| Add-ons | GET /v1/addons | list_add_ons | done |
| Add-ons | GET /v1/addons/{addon_id} | get_add_on | done |
| Add-ons | DELETE /v1/addons/{addon_id} | delete_add_on | done |
| Virtual accounts | POST /v1/virtual_accounts | create_virtual_account | done |
| Virtual accounts | GET /v1/virtual_accounts | list_virtual_accounts | done |
| Virtual accounts | GET /v1/virtual_accounts/{virtual_account_id} | get_virtual_account | done |
| Virtual accounts | POST /v1/virtual_accounts/{virtual_account_id}/close | close_virtual_account | done |
| Virtual accounts | GET /v1/virtual_accounts/{virtual_account_id}/payments | list_payments_into_virtual_account | done |
| Virtual accounts | POST /v1/virtual_accounts/{virtual_account_id}/receivers | add_receiver | done |
| Virtual accounts | POST /v1/virtual_accounts/{virtual_account_id}/allowed_payers | add_allowed_payer | done |
| Virtual accounts | DELETE /v1/virtual_accounts/{virtual_account_id}/allowed_payers/{allowed_payer_id} | delete_allowed_payer | done |
| QR codes | POST /v1/payments/qr_codes | create_qr_code | done |
| QR codes | GET /v1/payments/qr_codes | list_qr_codes | done |
| QR codes | GET /v1/payments/qr_codes/{qr_code_id} | get_qr_code | done |
| QR codes | GET /v1/payments/qr_codes/{qr_code_id}/payments | list_payments_for_qr_code | done |
| QR codes | POST /v1/payments/qr_codes/{qr_code_id}/close | close_qr_code | done |
| Route | POST /v1/transfers | create_direct_transfer | done |
| Route | POST /v1/payments/{payment_id}/transfers | split_a_payment | done |
| Route | GET /v1/transfers | list_transfers | done |
| Route | GET /v1/transfers/{transfer_id} | get_transfer | done |
| Route | GET /v1/payments/{payment_id}/transfers | list_transfers_for_payment | done |
| Route | PATCH /v1/transfers/{transfer_id} | update_transfer_hold | done |
| Route | POST /v1/transfers/{transfer_id}/reversals | reverse_transfer | done |
| Route | GET /v1/transfers/{transfer_id}/reversals | list_reversals_for_transfer | done |
| Disputes | GET /v1/disputes | list_disputes | done |
| Disputes | GET /v1/disputes/{dispute_id} | get_dispute | done |
| Disputes | POST /v1/disputes/{dispute_id}/accept | accept_dispute | done |
| Disputes | PATCH /v1/disputes/{dispute_id}/contest | contest_dispute | done |
| Webhooks | POST /v1/webhooks | create_webhook | done |
| Webhooks | GET /v1/webhooks | list_webhooks | done |
| Webhooks | PUT /v1/webhooks/{webhook_id} | update_webhook | done |
| Webhooks | POST /v2/accounts/{account_id}/webhooks | create_webhook_on_sub_merchant | done |
| Webhooks | GET /v2/accounts/{account_id}/webhooks | list_webhooks_on_sub_merchant | done |
| Webhooks | GET /v2/accounts/{account_id}/webhooks/{webhook_id} | get_webhook_on_sub_merchant | done |
| Webhooks | PATCH /v2/accounts/{account_id}/webhooks/{webhook_id} | update_webhook_on_sub_merchant | done |
| Webhooks | DELETE /v2/accounts/{account_id}/webhooks/{webhook_id} | delete_webhook_on_sub_merchant | done |
| Partner accounts | POST /v2/accounts | create_sub_merchant_account | done |
| Partner accounts | GET /v2/accounts/{account_id} | get_sub_merchant_account | done |
| Partner accounts | PATCH /v2/accounts/{account_id} | update_sub_merchant_account | done |
| Partner accounts | DELETE /v2/accounts/{account_id} | delete_sub_merchant_account | done |
| Partner accounts | POST /v2/accounts/{account_id}/stakeholders | create_stakeholder | done |
| Partner accounts | GET /v2/accounts/{account_id}/stakeholders | list_stakeholders | done |
| Partner accounts | GET /v2/accounts/{account_id}/stakeholders/{stakeholder_id} | get_stakeholder | done |
| Partner accounts | PATCH /v2/accounts/{account_id}/stakeholders/{stakeholder_id} | update_stakeholder | done |
| Partner accounts | POST /v2/accounts/{account_id}/products | request_product | done |
| Partner accounts | GET /v2/accounts/{account_id}/products/{product_id} | get_product_configuration | done |
| Partner accounts | PATCH /v2/accounts/{account_id}/products/{product_id} | update_product_configuration | done |
| Partner accounts | GET /v2/products/{product_name}/tnc | get_product_terms | done |
| Partner accounts | POST /v2/accounts/{account_id}/documents | upload_account_document | done |
| Partner accounts | GET /v2/accounts/{account_id}/documents | list_account_documents | done |
| Partner accounts | POST /v2/accounts/{account_id}/stakeholders/{stakeholder_id}/documents | upload_stakeholder_document | done |
| Partner accounts | GET /v2/accounts/{account_id}/stakeholders/{stakeholder_id}/documents | list_stakeholder_documents | done |
| Documents | POST /v1/documents | upload_document | done |
| Documents | GET /v1/documents/{document_id} | get_document | done |

### Left out

| What | Why |
| --- | --- |
| POST /v1/tokens (`create_token`) | skipped: it needs a raw card number and CVV. Every action's input is kept in `action_runs`, and Emplio must never store those. |
| `card` on `create_payment_s2s`, `number` on `get_card_fingerprint` | skipped for the same reason. Both still work with a saved card's token; the fingerprint also takes a payment id. |
| "Create or update the account's webhook" (businessos `ensureWebhook`) | skipped: `webhooks.ts` does this job when an automation is saved. `create_webhook` and `update_webhook` cover the API. |
| RazorpayX (payouts, contacts, transactions, balance) | skipped: a separate product on a separate contract, and not in the official SDK. It would be its own app. |
| POST /v1/tokens/service_provider_tokens/token_transactional_data | skipped: card-network reporting for aggregators, about a transaction made elsewhere. |
| GET /v1/offers | skipped: offers are made in the dashboard and only referred to by id. |
| GET /v1/settlements/ondemand/eligibility | skipped: not documented outside the dashboard; `create_instant_settlement` answers with the same limit. |

## Triggers

Can be checked every 5 minutes (`polls/razorpay.ts`). Razorpay has no event log, so these read its lists: a new row, or a row reaching a status.

| Trigger | List | Status it waits for | Look-back |
| --- | --- | --- | --- |
| new_payment | list_payments | any | 1 day |
| payment_captured | list_payments | captured | 3 days |
| payment_failed | list_payments | failed | 1 day |
| new_order | list_orders | any | 1 day |
| order_paid | list_orders | paid | 30 days |
| new_refund | list_refunds | any | 1 day |
| refund_processed | list_refunds | processed | 30 days |
| refund_failed | list_refunds | failed | 30 days |
| new_dispute | list_disputes | any | 1 day |
| new_settlement | list_settlements | any | 3 days |
| new_subscription | list_subscriptions | any | 1 day |
| subscription_halted | list_subscriptions | halted | 30 days |
| subscription_cancelled | list_subscriptions | cancelled | 30 days |
| new_invoice | list_invoices | any | 1 day |
| invoice_paid | list_invoices | paid | 30 days |
| invoice_expired | list_invoices | expired | 30 days |
| new_payment_link | list_payment_links | any | 1 day |
| payment_link_paid | list_payment_links | paid | 30 days |
| payment_link_expired | list_payment_links | expired | 30 days |
| new_virtual_account | list_virtual_accounts | any | 1 day |
| new_qr_code | list_qr_codes | any | 1 day |
| new_transfer | list_transfers | any | 1 day |
| new_customer | list_customers | any | 1 day |

Webhooks: `webhooks.ts` lists which of these Razorpay also pushes, and those arrive at once at `POST /webhooks/razorpay/:connection`. Saving the automation sets the webhook up by itself. If that fails (no `WEBHOOK_URL`, Razorpay's limit of 30 webhooks on the account), the trigger falls back to the checks above, which read only the newest 100 rows of a list each time. `new_payment`, `new_order`, `new_subscription`, `new_invoice`, `new_payment_link`, `new_transfer` and `new_customer` have no matching event, so they're always checked.

Webhook only, because a list can't show them: see `PUSHED` in `webhooks.ts` (30 triggers: disputes won and lost, subscription charged, payment outages, and so on). These fail with a message if the webhook can't be set up.

Razorpay's merchant API can't delete a webhook, so one stays on the account after its automations go, and its events are ignored. RazorpayX events (`payout.*`, `transaction.created`) are skipped with RazorpayX itself.

## Login

| Method | Status |
| --- | --- |
| Key ID and Key Secret, pasted as `KEY_ID:KEY_SECRET`, sent as HTTP Basic | done |
| OAuth | skipped: needs Razorpay Partner approval for Emplio; own apps connect with a pasted key. |

## Razorpay's quirks

- Amounts are in paise: 50000 is ₹500. Every amount field says so.
- It answers 400, not 404, for an id that doesn't exist.
- A product not switched on (Route, Smart Collect) answers 400 "The requested URL was not found on the server."
- `update_customer` is a PUT; every other update is a PATCH.
- Flags are 0/1 integers, not booleans.
- `expand` must go out as `expand[]` (`index.ts`).

## Verified

`bun test src/integrations/own/razorpay`. Against the real API with a test-mode key on 2026-11-05: connecting, a wrong key asking for a reconnect, every trigger's list, `create_order`, `get_order`, `get_order_with_transfers`, `list_payments` with `expand`, a missing id, and five more lists. `list_virtual_accounts` and `list_transfers` answered "URL not found" on that account, also with a plain curl, most likely because those products aren't on. Not called live: the other actions, including refunds, subscriptions and partner accounts; they come from the SDK's endpoint list.

Webhooks, against the real API with a test-mode key on 2026-11-05, through the dev tunnel: saving created the webhook with only the event needed, saving again made no second one, and a cancelled payment link's event reached `POST /webhooks/razorpay/:connection` in about 3 seconds, passed its signature check and got a 200. No automation was attached, so starting a run from a real event wasn't exercised; that step is the same `fire()` other triggers use. The check's webhook (url ending `e2e-check-2026-11-05`) stays on the test account, switched off.
