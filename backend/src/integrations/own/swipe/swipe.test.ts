import { afterEach, expect, test } from "bun:test";
import { AppFile, AppsError } from "../../types";
import { own } from "../index";

type Call = { method: string; url: URL; headers: Record<string, string>; body: any };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// records every request and answers with reply(call); anything unanswered is a test bug, not a trip to Swipe
function stub(reply: (c: Call) => Response | undefined) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const raw = init.body;
    const c = { method: init.method!, url: new URL(url), headers: init.headers as Record<string, string>, body: raw instanceof FormData ? raw : raw ? JSON.parse(String(raw)) : undefined };
    calls.push(c);
    const r = reply(c);
    if (!r) throw new Error(`unexpected ${c.method} ${c.url}`);
    return r;
  }) as typeof fetch;
  return calls;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const run = (action: string, input: unknown) => own.run(`swipe.${action}`, input, { externalId: "", secret: "key" }, "owner");
const fails = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected it to fail");
    },
    (e: AppsError) => e,
  );

test("a lookup goes to the v2 path with the key as a bearer", async () => {
  const calls = stub(() => json({ success: true, data: { legal_name: "Acme" } }));
  await run("lookup_gstin", { gstin: "29ABCDE1234F1Z5" });
  expect(calls[0]!.method).toBe("GET");
  expect(calls[0]!.url.href).toBe("https://app.getswipe.in/api/partner/v2/utils/gstin/29ABCDE1234F1Z5");
  expect(calls[0]!.headers.Authorization).toBe("Bearer key");
});

test("products are created through the v1 JSON call", async () => {
  const calls = stub(() => json({ success: true, data: {} }));
  await run("create_product", { id: "P1", name: "Tea", price_with_tax: 100, unit_price: 100, tax_rate: 5, product_type: "Product", unit: "KG", hsn_code: "0902", quantity: 0, item_type: "Product" });
  expect(calls[0]!.method).toBe("POST");
  expect(calls[0]!.url.pathname).toBe("/api/partner/v1/product");
  expect(calls[0]!.body.name).toBe("Tea");
});

test("a 200 with success false is a failure, with Swipe's code", async () => {
  stub(() => json({ success: false, error_code: "INVALID_HASH_ID", message: "Invalid hash id" }));
  const e = await fails(run("get_document", { doc_hash_id: "x" }));
  expect(e.message).toBe("Swipe: INVALID_HASH_ID: Invalid hash id");
});

test("a 401 FORBIDDEN is a plan limit, not a dead key; a plain 401 is", async () => {
  stub(() => json({ success: false, error_code: "FORBIDDEN", message: "Not allowed on your plan" }, 401));
  const plan = await fails(run("list_warehouses", {}));
  expect(plan.message).toContain("Not allowed on your plan");
  stub(() => json({ success: false, error_code: "UNAUTHORIZED", message: "bad key" }, 401));
  const dead = await fails(run("list_warehouses", {}));
  expect(dead.message).toContain("rejected the token");
});

test("an expense update puts the expense in the query (objects as JSON) and the receipts in the body", async () => {
  const calls = stub(() => json({ success: true, data: {} }));
  const receipt = new AppFile("r.pdf", "application/pdf", new Uint8Array([1, 2, 3]));
  const items = [{ category: "Rent", net_amount: 100 }];
  await run("update_expense", { hash_id: "h1", amount: 100, document_date: "01-10-2026", items, party: { name: "Landlord" }, payment_details: { amount: 100 }, attachments: [receipt] });
  const q = calls[0]!.url.searchParams;
  expect(calls[0]!.url.pathname).toBe("/api/partner/v2/expense/h1");
  expect(q.get("items")).toBe(JSON.stringify(items));
  expect(q.get("party")).toBe('{"name":"Landlord"}');
  expect(q.get("amount")).toBe("100");
  expect(q.has("attachments")).toBe(false);
  expect((calls[0]!.body as FormData).getAll("attachments")).toHaveLength(1);
});

test("an expense update without receipts sends no body", async () => {
  const calls = stub(() => json({ success: true, data: {} }));
  await run("update_expense", { hash_id: "h1", amount: 1, document_date: "01-10-2026", items: [{}], party: {}, payment_details: {} });
  expect(calls[0]!.body).toBeUndefined();
});
