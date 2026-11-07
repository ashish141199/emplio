import { afterEach, expect, test } from "bun:test";
import { own } from "../index";
import { exa } from "./index";

type Call = { method: string; url: URL; headers: Record<string, string>; body: any };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stub(reply: (c: Call) => Response | undefined) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const c = { method: init.method!, url: new URL(url), headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    const r = reply(c);
    if (!r) throw new Error(`unexpected ${c.method} ${c.url}`);
    return r;
  }) as typeof fetch;
  return calls;
}
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
const run = (action: string, input: unknown) => own.run(`exa.${action}`, input, { externalId: "", secret: "exa-key" }, "owner");

test("websets go to the websets server with the key in x-api-key", async () => {
  const calls = stub(() => json({ id: "ws_1" }));
  const search = { query: "D2C skincare brands in India", count: 50 };
  await run("create_webset", { search });
  expect(calls[0]!.url.href).toBe("https://api.exa.ai/websets/v0/websets");
  expect(calls[0]!.headers["x-api-key"]).toBe("exa-key");
  expect(calls[0]!.headers.Authorization).toBeUndefined();
  expect(calls[0]!.body).toEqual({ search });
});

test("search_advanced takes Exa's own options, and the friendly search is still there", async () => {
  const calls = stub(() => json({ results: [] }));
  await run("search_advanced", { query: "x", numResults: 3, contents: { text: true } });
  expect(calls[0]!.url.href).toBe("https://api.exa.ai/search");
  // with the spec's defaults, sent as given
  expect(calls[0]!.body).toEqual({
    query: "x",
    numResults: 3,
    type: "auto",
    moderation: false,
    contents: { text: true, livecrawlTimeout: 10000, subpages: 0 },
  });
  expect(exa.actions.search!.input.shape).toHaveProperty("num_results");
  expect(exa.actions.search_advanced!.readOnly).toBe(true);
  expect(exa.actions.delete_webset!.readOnly).toBe(false);
});
