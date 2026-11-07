// Swipe (getswipe.in): what the generator (../openapi-actions.ts) can't tell from the spec.
import type { AppConfig } from "../openapi-actions";

// Swipe's operation ids repeat (three get_transactions, two get_pdf), so actions are named by the call
const NAMES: Record<string, string> = {
  "POST /v2/doc": "create_document",
  "GET /v2/doc/list": "list_documents",
  "GET /v2/doc/{doc_hash_id}": "get_document",
  "PUT /v2/doc/{doc_hash_id}": "update_document",
  "DELETE /v2/doc/{doc_hash_id}": "cancel_document",
  "GET /v2/doc/pdf/{doc_hash_id}": "get_document_pdf",
  "POST /v2/customer": "create_customer",
  "PUT /v2/customer": "update_customer",
  "GET /v2/customer/{customer_id}": "get_customer",
  "DELETE /v2/customer/{customer_id}": "delete_customer",
  "GET /v2/customer/list": "list_customers",
  "POST /v2/customer/list": "map_customers",
  "GET /v2/customer/ledger": "get_customer_ledger",
  "POST /v2/vendor": "create_vendor",
  "PUT /v2/vendor": "update_vendor",
  "GET /v2/vendor/{vendor_id}": "get_vendor",
  "DELETE /v2/vendor/{vendor_id}": "delete_vendor",
  "GET /v2/vendor/list": "list_vendors",
  "POST /v2/vendor/list": "map_vendors",
  "GET /v2/vendor/ledger": "get_vendor_ledger",
  "POST /v1/product": "create_product",
  "PUT /v1/product": "update_product",
  "GET /v2/product/{item_id}": "get_product",
  "DELETE /v2/product/{item_id}": "delete_product",
  "GET /v2/product/list": "list_products",
  "POST /v2/product/list": "map_products",
  "POST /v2/payment": "record_payment",
  "GET /v2/payment/list": "list_payments",
  "POST /v2/inventory/stock": "adjust_stock",
  "GET /v2/inventory/warehouses/list": "list_warehouses",
  "GET /v2/subscriptions/list": "list_subscriptions",
  "GET /v2/subscriptions/{subscription_hash_id}": "get_subscription",
  "POST /v2/ewaybill/{doc_hash_id}": "create_eway_bill",
  "GET /v2/ewaybill/pdf/{doc_hash_id}": "get_eway_bill_pdf",
  "GET /v2/utils/gstin/{gstin}": "lookup_gstin",
};

export default {
  spec: "https://developers.getswipe.in/api-reference/openapi.json",
  out: "src/integrations/own/swipe/actions.json",
  name: (id, method, path) => NAMES[`${method} ${path}`] ?? id,
  skip: (method, path) => {
    // v2's product create/update is declared as an images-only form; v1's JSON body is the same call, complete
    if (path === "/v2/product" && method !== "GET") return "the spec gives only product_images for its body; the identical v1 call (JSON) is used instead";
    if (path.startsWith("/v1/") && path !== "/v1/product") return "identical to its /v2 twin";
  },
} satisfies AppConfig;
