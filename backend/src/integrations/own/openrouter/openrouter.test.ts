import { afterEach, expect, test } from "bun:test";
import { AppsError } from "../../types";
import { openrouter } from "../ai";
import { own } from "../index";

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
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const run = (action: string, input: unknown) => own.run(`openrouter.${action}`, input, { externalId: "", secret: "sk-or-1" }, "owner");

test("the rest of OpenRouter's API sits beside generate and list_models", async () => {
  expect(Object.keys(openrouter.actions)).toEqual(expect.arrayContaining(["generate", "list_models", "get_credits", "create_key", "create_embeddings"]));
  const calls = stub(() => json({ data: { total_credits: 10, total_usage: 2 } }));
  await run("get_credits", {});
  expect(calls[0]!.url.href).toBe("https://openrouter.ai/api/v1/credits");
  expect(calls[0]!.headers.Authorization).toBe("Bearer sk-or-1");
});

test("query params go in the query, body fields in the body, attribution headers nowhere", async () => {
  const calls = stub(() => json({ data: { key: "sk-or-new" } }));
  await run("get_generation", { id: "gen-1" });
  await run("create_key", { name: "bot", limit: 5 });
  expect(calls[0]!.url.href).toBe("https://openrouter.ai/api/v1/generation?id=gen-1");
  expect(calls[1]!.body).toEqual({ name: "bot", limit: 5 });
  expect(Object.keys(openrouter.actions.chat_completion!.input.shape)).not.toContain("http_referer");
  expect(openrouter.actions.create_key!.readOnly).toBe(false);
  expect(openrouter.actions.chat_completion!.readOnly).toBe(true);
});

test("a dead key asks for reconnecting", async () => {
  stub(() => json({ error: { message: "User not found." } }, 401));
  const e = (await run("get_credits", {}).catch((x) => x)) as AppsError;
  expect(e.expired).toBe(true);
});
