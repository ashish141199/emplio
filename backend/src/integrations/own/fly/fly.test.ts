import { afterEach, expect, test } from "bun:test";
import { AppsError } from "../../types";
import { own } from "../index";
import { fly } from "./index";

type Call = { method: string; url: URL; headers: Record<string, string>; body: any };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// records every request and answers with reply(call); anything unanswered is a test bug, not a trip to Fly
function stub(reply: (c: Call) => { status?: number; body?: unknown; headers?: Record<string, string> } | undefined) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const c = { method: init.method!, url: new URL(url), headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    const r = reply(c);
    if (!r) throw new Error(`unexpected ${c.method} ${c.url}`);
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status ?? 200, headers: r.headers });
  }) as typeof fetch;
  return calls;
}

const TOKEN = "FlyV1 fm2_test";
// the error a call fails with; a call that succeeds fails the test
const fails = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected it to fail");
    },
    (e: AppsError) => e,
  );
const run = (action: string, input: unknown, secret = TOKEN) => own.run(`fly.${action}`, input, { externalId: "", secret }, "owner");

test("a machine is created with exactly the fields given, and the token goes in the header as is", async () => {
  const calls = stub(() => ({ body: { id: "m1" } }));
  await run("create_machine", { app: "shop", region: "bom", config: { image: "nginx", guest: { cpus: 1 } } });
  expect(calls[0]!.method).toBe("POST");
  expect(calls[0]!.url.href).toBe("https://api.machines.dev/v1/apps/shop/machines");
  expect(calls[0]!.body).toEqual({ config: { image: "nginx", guest: { cpus: 1 } }, region: "bom" });
  expect(calls[0]!.headers.Authorization).toBe(TOKEN);
});

test("a token without the FlyV1 prefix is sent as a bearer token", async () => {
  const calls = stub(() => ({ body: [] }));
  await run("get_regions", {}, "abc123");
  expect(calls[0]!.headers.Authorization).toBe("Bearer abc123");
});

test("path parts are escaped, query fields go in the URL and nothing goes in the body", async () => {
  const calls = stub(() => ({ body: {} }));
  await run("restart_machine", { app: "shop", machine: "m/1", signal: "SIGTERM" });
  expect(calls[0]!.url.pathname).toBe("/v1/apps/shop/machines/m%2F1/restart");
  expect(Object.fromEntries(calls[0]!.url.searchParams)).toEqual({ signal: "SIGTERM" });
  expect(calls[0]!.body).toBeUndefined();
});

test("machine lists filter by metadata and hand back the next page's cursor", async () => {
  const calls = stub(() => ({ body: [{ id: "m1" }], headers: { "fly-next-cursor": "c2" } }));
  const out = await run("list_machines", { app: "shop", metadata: { fly_process_group: "app" }, limit: 1 });
  expect(Object.fromEntries(calls[0]!.url.searchParams)).toEqual({ summary: "true", limit: "1", "metadata.fly_process_group": "app" });
  expect(out).toEqual({ items: [{ id: "m1" }], next_cursor: "c2" });
});

test("secrets are listed without values; only reveal_secrets asks for them, and it needs an OK", async () => {
  const calls = stub(() => ({ body: { secrets: [] } }));
  await run("list_secrets", { app: "shop" });
  await run("reveal_secrets", { app: "shop" });
  expect(calls[0]!.url.searchParams.has("show_secrets")).toBe(false);
  expect(calls[1]!.url.searchParams.get("show_secrets")).toBe("true");
  expect(fly.actions.list_secrets!.readOnly).toBe(true);
  expect(fly.actions.reveal_secrets!.readOnly).toBe(false);
  expect(fly.actions.get_postgres_credentials!.readOnly).toBe(false);
});

test("a shell line runs through sh; releasing a lease sends its nonce", async () => {
  const calls = stub(() => ({ body: { stdout: "ok", exit_code: 0 } }));
  await run("exec", { app: "shop", machine: "m1", command: "df -h /data" });
  expect(calls[0]!.body).toEqual({ command: ["sh", "-c", "df -h /data"] });
  await run("release_lease", { app: "shop", machine: "m1", nonce: "n1" });
  expect(calls[1]!.method).toBe("DELETE");
  expect(calls[1]!.headers["fly-machine-lease-nonce"]).toBe("n1");
});

test("an empty answer comes back as ok", async () => {
  stub(() => ({ status: 200 }));
  expect(await run("delete_secret", { app: "shop", name: "OLD" })).toEqual({ ok: true });
});

test("a rejected token asks for reconnecting; other failures carry Fly's words", async () => {
  stub(() => ({ status: 401, body: { error: "unauthorized" } }));
  const e1 = await fails(run("get_app", { app: "shop" }));
  expect(e1).toBeInstanceOf(AppsError);
  expect(e1.expired).toBe(true);
  stub(() => ({ status: 404, body: { error: "machine not found" } }));
  const e2 = await fails(run("get_machine", { app: "shop", machine: "nope" }));
  expect(e2.message).toBe("Fly.io: machine not found (404)");
  expect(e2.expired).toBe(false);
});

test("bad input is refused before any request", async () => {
  const calls = stub(() => ({ body: {} }));
  const e = await fails(run("extend_volume", { app: "shop", volume: "vol_1", size_gb: "big" }));
  expect(e).toBeInstanceOf(AppsError);
  expect(calls).toHaveLength(0);
});

test("encrypting takes text and answers in base64; decrypting gives the text back", async () => {
  const calls = stub((c) => (c.url.pathname.endsWith("/encrypt") ? { body: { ciphertext: [1, 2, 3] } } : { body: { plaintext: [...Buffer.from("hi")] } }));
  expect(await run("encrypt", { app: "shop", name: "k", plaintext: "hi" })).toEqual({ ciphertext_base64: "AQID" });
  expect(calls[0]!.body).toEqual({ plaintext: [104, 105] });
  expect(await run("decrypt", { app: "shop", name: "k", ciphertext_base64: "AQID" })).toEqual({ plaintext_base64: "aGk=", plaintext: "hi" });
  expect(calls[1]!.body).toEqual({ ciphertext: [1, 2, 3] });
});

test("an organization change looks up the organization's id from its slug first", async () => {
  const calls = stub((c) =>
    c.body.query.includes("organization(slug")
      ? { body: { data: { organization: { id: "org_9" } } } }
      : { body: { data: { createOrganizationInvitation: { invitation: { id: "i1" } } } } },
  );
  await run("invite_member", { org: "acme", email: "a@b.co" });
  expect(calls[0]!.body.variables).toEqual({ slug: "acme" });
  expect(calls[1]!.url.href).toBe("https://api.fly.io/graphql");
  expect(calls[1]!.body.variables).toEqual({ input: { organizationId: "org_9", email: "a@b.co" } });
  expect(fly.actions.invite_member!.readOnly).toBe(false);
});

test("GraphQL errors come back in Fly's words; raw queries refuse to change anything", async () => {
  stub(() => ({ body: { data: null, errors: [{ message: "Could not find App" }] } }));
  const e = await fails(run("list_releases", { app: "nope" }));
  expect(e.message).toBe("Fly.io: Could not find App");
  const calls = stub(() => ({ body: {} }));
  const refused = await fails(run("graphql_query", { query: "mutation { logOut { ok } }" }));
  expect(refused).toBeInstanceOf(AppsError);
  expect(calls).toHaveLength(0);
});

test("logs come back as plain lines with the token for the next page", async () => {
  const calls = stub(() => ({ body: { data: [{ id: "1", attributes: { timestamp: "t", message: "boot", level: "info" } }], meta: { next_token: "nt" } } }));
  const out = await run("get_logs", { app: "shop", region: "bom" });
  expect(calls[0]!.url.href).toBe("https://api.fly.io/api/v1/apps/shop/logs?region=bom");
  expect(out).toEqual({ lines: [{ timestamp: "t", message: "boot", level: "info" }], next_token: "nt" });
});
