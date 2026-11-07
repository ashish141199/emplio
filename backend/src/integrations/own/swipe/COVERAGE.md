# Swipe coverage

Source: Swipe's OpenAPI spec (https://developers.getswipe.in/api-reference/openapi.json), generated 2026-10-26
by `bun scripts/openapi-actions.ts swipe`, plus the earlier businessos `getswipe` integration for the expense
calls. n8n has no Swipe node. 40 actions: every /v2 operation (35 from the spec) and the 5 expense calls.

## By hand (index.ts)

Expenses dropped out of Swipe's spec but still answer (a key-less call gets 401, an unknown path 404):
list_expenses, get_expense, update_expense, cancel_expense, get_expense_pdf. update_expense sends the expense in
the query (items, party and payment_details as JSON text) and the receipts as a multipart body, as Swipe reads it.

## Deliberately left out

| What | Why |
| --- | --- |
| POST /v1/customer (post_customer) | identical to its /v2 twin |
| PUT /v1/customer (put_customer) | identical to its /v2 twin |
| GET /v1/customer/ledger (get_customer_ledger) | identical to its /v2 twin |
| GET /v1/customer/list (get_customer_list) | identical to its /v2 twin |
| POST /v1/customer/list (post_customer_list) | identical to its /v2 twin |
| GET /v1/customer/{customer_id} (get_customer) | identical to its /v2 twin |
| DELETE /v1/customer/{customer_id} (delete_customer) | identical to its /v2 twin |
| POST /v1/doc (post_invoice_resource) | identical to its /v2 twin |
| GET /v1/doc/pdf/{doc_hash_id} (get_pdf) | identical to its /v2 twin |
| DELETE /v1/doc/{doc_hash_id} (delete_cancel_invoice) | identical to its /v2 twin |
| POST /v1/payment (post_payment) | identical to its /v2 twin |
| GET /v1/product/list (get_item_list) | identical to its /v2 twin |
| POST /v1/product/list (post_item_list) | identical to its /v2 twin |
| GET /v1/product/{item_id} (get_product) | identical to its /v2 twin |
| DELETE /v1/product/{item_id} (delete_product) | identical to its /v2 twin |
| GET /v1/subscriptions/list (get_transactions) | identical to its /v2 twin |
| GET /v1/subscriptions/{subscription_hash_id} (get_subscription) | identical to its /v2 twin |
| GET /v1/utils/gstin/{gstin} (get_utils) | identical to its /v2 twin |
| POST /v2/product (post_product) | the spec gives only product_images for its body; the identical v1 call (JSON) is used instead |
| PUT /v2/product (put_product) | the spec gives only product_images for its body; the identical v1 call (JSON) is used instead |
| Product images | Only v2 takes them, and its declared body has nothing else; add them in the Swipe app |
| Create expense | Swipe has no such call; expenses are raised in the Swipe app |
| Events (triggers) | Own apps have no triggers yet. Swipe's webhooks (document, inventory) are set in its dashboard, one URL per account |
| OAuth | Swipe only offers API keys |

## Quirks

- Every answer is `{success, message, error_code, errors, data}`; `success: false` with a 200 is an error.
- 401 `FORBIDDEN` means the plan can't do it, not a dead key, so it doesn't ask to reconnect.
- Dates are DD-MM-YYYY everywhere. 1 request per second.
- Ids on parties and items are the business's own; an unknown one creates the record. map_* relinks them.
- E-invoices (`einvoice: true` on create_document) and e-way bills are a paid add-on.

Not verified against the live API: no Swipe key.
