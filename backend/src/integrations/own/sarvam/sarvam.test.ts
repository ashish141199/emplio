import { afterEach, expect, test } from "bun:test";
import { AppFile, AppsError } from "../../types";
import { own } from "../index";
import { sarvam } from "./index";

type Call = { method: string; url: URL; headers: Record<string, string>; body: any };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// records every request and answers with reply(call); anything unanswered is a test bug, not a trip to Sarvam
function stub(reply: (c: Call) => Response | undefined) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const raw = init.body;
    const c = { method: init.method!, url: new URL(url), headers: init.headers as Record<string, string>, body: typeof raw === "string" ? JSON.parse(raw) : raw };
    calls.push(c);
    const r = reply(c);
    if (!r) throw new Error(`unexpected ${c.method} ${c.url}`);
    return r;
  }) as typeof fetch;
  return calls;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const run = (action: string, input: unknown) => own.run(`sarvam.${action}`, input, { externalId: "", secret: "sk_test" }, "owner");
const fails = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected it to fail");
    },
    (e: AppsError) => e,
  );

test("a model call sends the key in Sarvam's header and only the fields given", async () => {
  const calls = stub(() => json({ translated_text: "नमस्ते" }));
  await run("translate", { input: "Hello", source_language_code: "en-IN", target_language_code: "hi-IN" });
  expect(calls[0]!.url.href).toBe("https://api.sarvam.ai/translate");
  expect(calls[0]!.headers["api-subscription-key"]).toBe("sk_test");
  expect(calls[0]!.body).toEqual({ input: "Hello", source_language_code: "en-IN", target_language_code: "hi-IN" });
});

test("an audio file goes up as multipart, with the other fields beside it", async () => {
  const calls = stub(() => json({ transcript: "hi" }));
  const audio = new AppFile("call.wav", "audio/wav", new Uint8Array([1, 2, 3]));
  await run("speech_to_text", { file: audio, language_code: "hi-IN" });
  const form = calls[0]!.body as FormData;
  expect(form).toBeInstanceOf(FormData);
  expect(calls[0]!.headers["Content-Type"]).toBeUndefined();
  const file = form.get("file") as File;
  expect(file.name).toBe("call.wav");
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  expect(form.get("language_code")).toBe("hi-IN");
  // and the spec's defaults, sent as given
  expect([...form.keys()].sort()).toEqual(["file", "language_code", "mode", "with_timestamps"]);
});

test("speech comes back as audio files, not base64", async () => {
  stub(() => json({ request_id: "r1", audios: [Buffer.from("RIFF").toString("base64")] }));
  const out = (await run("text_to_speech", { text: "Namaste", language_code: "hi-IN" })) as { request_id: string; audios: AppFile[] };
  expect(out.request_id).toBe("r1");
  expect(out.audios[0]).toBeInstanceOf(AppFile);
  expect(new TextDecoder().decode(out.audios[0]!.bytes)).toBe("RIFF");
});

test("dubbing and Voice Agents calls go to their own servers", async () => {
  const calls = stub(() => json({}));
  await run("dubbing_get_live_status", { job_id: "j1" });
  await run("list_deployments", { org_id: "o1", workspace_id: "w1", limit: 5 });
  await run("create_campaign", { org_id: "o1", workspace_id: "w1" }).catch(() => {});
  await run("list_interactions", { org_id: "o1", workspace_id: "w1", app_id: "a1" }).catch(() => {});
  await run("list_test_suites", { org_id: "o1", workspace_id: "w1" });
  const urls = calls.map((c) => `${c.url.origin}${c.url.pathname}`);
  expect(urls).toContain("https://api.sarvam.ai/dubbing/jobs/j1/live-status");
  expect(urls).toContain("https://apps.sarvam.ai/api/app-authoring/v1/orgs/o1/workspaces/w1/deployments");
  expect(urls).toContain("https://apps.sarvam.ai/api/evals/v1/o1/w1/test-suites");
  expect(calls.find((c) => c.url.pathname.endsWith("/deployments"))!.headers["X-API-Key"]).toBe("sk_test");
});

test("the key is never an input; answers that cost nothing to undo run without asking", async () => {
  for (const a of Object.values(sarvam.actions)) expect(Object.keys(a.input.shape)).not.toContain("x_api_key");
  expect(sarvam.actions.translate!.readOnly).toBe(true);
  expect(sarvam.actions.start_outbound_call!.readOnly).toBe(false);
  expect(sarvam.actions.delete_cloned_voice!.readOnly).toBe(false);
});

test("a rejected key asks for reconnecting", async () => {
  stub(() => json({ error: { message: "Invalid API key", code: "invalid_api_key_error" } }, 403));
  expect((await fails(run("list_cloned_voices", {}))).expired).toBe(true);
});
