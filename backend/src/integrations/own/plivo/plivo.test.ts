import { afterEach, expect, test } from "bun:test";
import { z } from "zod";
import { AppFile, AppsError } from "../../types";
import { plivo } from "./index";
import { accountActions } from "./account";
import { messagingActions } from "./messaging";
import { numberActions } from "./numbers";
import { voiceActions } from "./voice";
import { zentrunkActions } from "./zentrunk";

type Call = { method: string; url: URL; headers: Record<string, string>; body: any };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// records every request and answers with reply(call); anything unanswered is a test bug, not a trip to Plivo
function stub(reply: (c: Call) => { status?: number; body?: unknown } | undefined = () => ({ body: {} })) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const raw = init.body;
    const c = { method: init.method!, url: new URL(url), headers: init.headers as Record<string, string>, body: typeof raw === "string" ? JSON.parse(raw) : raw };
    calls.push(c);
    const r = reply(c);
    if (!r) throw new Error(`unexpected ${c.method} ${c.url}`);
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

const KEY = "MAAUTHID123:tok3n";
const BASIC = `Basic ${Buffer.from(KEY).toString("base64")}`;
const ACCOUNT = "https://api.plivo.com/v1/Account/MAAUTHID123";
// as own.run does it: check the input, then run (plivo isn't in APPS until it's registered)
const run = (action: string, input: unknown, key = KEY) => {
  const a = plivo.actions[action];
  if (!a) throw new Error(`no action ${action}`);
  return a.run(a.input.parse(input), key);
};
const fails = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected it to fail");
    },
    (e: AppsError) => e,
  );

test("no two groups name an action the same, and every input turns into a JSON schema", () => {
  const groups = [accountActions, messagingActions, voiceActions, numberActions, zentrunkActions];
  const total = groups.reduce((n, g) => n + Object.keys(g).length, 0);
  expect(Object.keys(plivo.actions)).toHaveLength(total);
  for (const [name, a] of Object.entries(plivo.actions)) {
    expect(name).toMatch(/^[a-z0-9_]+$/);
    expect(() => z.toJSONSchema(a.input, { io: "input" })).not.toThrow();
  }
});

test("a message is sent to the account's path with Basic auth and exactly the fields given", async () => {
  const calls = stub(() => ({ body: { message_uuid: ["m1"] } }));
  await run("send_message", { src: "+14155551234", dst: "+919876543210", text: "hi", type: "whatsapp", template: { name: "t", language: "en" } });
  expect(calls[0]!.method).toBe("POST");
  expect(calls[0]!.url.href).toBe(`${ACCOUNT}/Message/`);
  expect(calls[0]!.headers.Authorization).toBe(BASIC);
  expect(calls[0]!.body).toEqual({ src: "+14155551234", dst: "+919876543210", text: "hi", type: "whatsapp", template: { name: "t", language: "en" } });
  expect(plivo.actions.send_message!.readOnly).toBe(false);
});

test("a call's path parts fill in, and a DELETE sends its fields in the query", async () => {
  const calls = stub(() => ({ status: 204 }));
  await run("stop_call_recording", { call_uuid: "c-1", URL: "https://x/r.mp3" });
  expect(calls[0]!.method).toBe("DELETE");
  expect(calls[0]!.url.href).toBe(`${ACCOUNT}/Call/c-1/Record/?URL=${encodeURIComponent("https://x/r.mp3")}`);
  expect(calls[0]!.body).toBeUndefined();
});

test("live calls are listed with status=live put in for the agent", async () => {
  const calls = stub(() => ({ body: { calls: [] } }));
  await run("list_live_calls", {});
  expect(calls[0]!.url.href).toBe(`${ACCOUNT}/Call/?status=live`);
  expect(plivo.actions.list_live_calls!.readOnly).toBe(true);
});

test("conference member and MPC actions reach their nested paths", async () => {
  const calls = stub();
  await run("speak_to_conference_member", { conference_name: "standup", member_id: "all", text: "Five minutes left" });
  expect(calls[0]!.url.href).toBe(`${ACCOUNT}/Conference/standup/Member/all/Speak/`);
  expect(calls[0]!.body).toEqual({ text: "Five minutes left" });
  await run("start_mpc", { mpc: "name_support" });
  expect(calls[1]!.url.href).toBe(`${ACCOUNT}/MultiPartyCall/name_support/`);
  expect(calls[1]!.body).toEqual({ status: "active" });
});

test("lookup, call feedback and PHLO go to their own hosts", async () => {
  const calls = stub();
  await run("lookup_number", { number: "+919876543210" });
  expect(calls[0]!.url.href).toBe("https://lookup.plivo.com/v1/Number/%2B919876543210?type=carrier");
  expect(calls[0]!.headers.Authorization).toBe(BASIC);
  await run("send_call_feedback", { call_uuid: "c-1", rating: 3, issues: ["ECHO"] });
  expect(calls[1]!.url.href).toBe("https://stats.plivo.com/v1/Call/c-1/Feedback/");
  expect(calls[1]!.body).toEqual({ rating: 3, issues: ["ECHO"] });
  await run("run_phlo", { phlo_id: "p1", from: "+14155551234", to: "+919876543210", item: "pizza" });
  expect(calls[2]!.url.href).toBe("https://phlorunner.plivo.com/v1/account/MAAUTHID123/phlo/p1/");
  expect(calls[2]!.body).toEqual({ from: "+14155551234", to: "+919876543210", item: "pizza" });
});

test("buying a number to a pool always asks Plivo to rent it", async () => {
  const calls = stub();
  await run("buy_pool_number", { pool_uuid: "pool1", number: "14155551234" });
  expect(calls[0]!.url.href).toBe(`${ACCOUNT}/NumberPool/pool1/Number/14155551234/`);
  expect(calls[0]!.body).toEqual({ rent: "true" });
});

test("a zentrunk trunk is made with its body as given", async () => {
  const calls = stub(() => ({ body: { trunk_id: "t1" } }));
  await run("create_trunk", { trunk_direction: "outbound", name: "pbx", ipacl_uuid: "acl1" });
  expect(calls[0]!.url.href).toBe(`${ACCOUNT}/Zentrunk/Trunk/`);
  expect(calls[0]!.body).toEqual({ trunk_direction: "outbound", name: "pbx", ipacl_uuid: "acl1" });
});

test("compliance files go as documents[n].file next to the JSON data", async () => {
  const calls = stub();
  const pdf = new AppFile("pan.pdf", "application/pdf", new Uint8Array([1, 2]));
  await run("create_number_compliance", { data: { country_iso: "IN", number_type: "local" }, documents: [pdf] });
  const form = calls[0]!.body as FormData;
  expect(calls[0]!.url.href).toBe(`${ACCOUNT}/PhoneNumber/Compliance/`);
  expect(JSON.parse(form.get("data") as string)).toEqual({ country_iso: "IN", number_type: "local" });
  expect((form.get("documents[0].file") as File).name).toBe("pan.pdf");
  expect(form.has("documents")).toBe(false);
});

test("check reads the account, and refuses a key without the colon before calling anyone", async () => {
  const calls = stub(() => ({ body: { auth_id: "MAAUTHID123" } }));
  await plivo.check(KEY);
  expect(calls[0]!.method).toBe("GET");
  expect(calls[0]!.url.href).toBe(`${ACCOUNT}/`);
  const e = await fails(plivo.check("MAAUTHID123"));
  expect(e).toBeInstanceOf(AppsError);
  expect(calls).toHaveLength(1);
});

test("rejected credentials ask for reconnecting; other failures carry Plivo's words", async () => {
  stub(() => ({ status: 401, body: { error: "authentication failed" } }));
  expect((await fails(run("get_account", {}))).expired).toBe(true);
  stub(() => ({ status: 404, body: { api_id: "a", error: "not found" } }));
  const e = await fails(run("get_call", { call_uuid: "nope" }));
  expect(e.expired).toBe(false);
  expect(e.message).toContain("not found");
});
