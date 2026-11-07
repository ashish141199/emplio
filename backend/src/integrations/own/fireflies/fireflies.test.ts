import { afterEach, expect, test } from "bun:test";
import { AppsError } from "../../types";
import { own } from "../index";
import { fireflies, lit } from "./index";

type Call = { headers: Record<string, string>; query: string };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// records every query and answers with `data`, or with Fireflies' error shape
function stub(data: unknown, errors?: unknown[]) {
  const calls: Call[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    calls.push({ headers: init.headers as Record<string, string>, query: JSON.parse(String(init.body)).query });
    return new Response(JSON.stringify(errors ? { data: null, errors } : { data }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

const run = (action: string, input: unknown) => own.run(`fireflies.${action}`, input, { externalId: "", secret: "key" }, "owner");
const fails = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected it to fail");
    },
    (e: AppsError) => e,
  );

test("values become GraphQL literals: strings quoted and escaped, objects with bare keys", () => {
  expect(lit({ title: 'Q3 "review"', ids: ["a", "b"], n: 2, ok: true, gone: undefined })).toBe('{title: "Q3 \\"review\\"", ids: ["a", "b"], n: 2, ok: true}');
});

test("only the filters given are sent, and the answer is the list itself", async () => {
  const calls = stub({ transcripts: [{ id: "t1" }] });
  const out = await run("list_meetings", { keyword: "pricing", participants: ["a@b.co"], with_summary: false });
  expect(calls[0]!.query).toStartWith('query { transcripts(keyword: "pricing", participants: ["a@b.co"], limit: 20) { id title');
  expect(calls[0]!.query).not.toContain("summary {");
  expect(calls[0]!.headers.Authorization).toBe("Bearer key");
  expect(out).toEqual([{ id: "t1" }]);
});

test("the transcript's sentences come only when asked for", async () => {
  const calls = stub({ transcript: { id: "t1" } });
  await run("get_meeting", { id: "t1" });
  await run("get_meeting", { id: "t1", include_transcript: true });
  expect(calls[0]!.query).not.toContain("sentences");
  expect(calls[1]!.query).toContain("sentences { index speaker_name");
});

test("enum values are written bare, inside inputs too", async () => {
  const calls = stub({ updateMeetingPrivacy: { id: "t1" } });
  await run("set_meeting_privacy", { id: "t1", privacy: "teammates" });
  expect(calls[0]!.query).toBe('mutation { updateMeetingPrivacy(input: {id: "t1", privacy: teammates}) { id title privacy } }');
  await run("active_meetings", { states: ["active"] });
  expect(calls[1]!.query).toContain("active_meetings(input: {states: [active]})");
});

test("a question about one meeting sends no cross-meeting filters", async () => {
  const calls = stub({ createAskFredThread: { message: { answer: "Friday" } } });
  const out = await run("ask", { query: "When is delivery?", meeting_id: "t1", format_mode: "plaintext" });
  expect(calls[0]!.query).toContain('createAskFredThread(input: {query: "When is delivery?", transcript_id: "t1", format_mode: plaintext})');
  expect(out).toEqual({ message: { answer: "Friday" } });
});

test("changes ask first; reading and asking questions don't", () => {
  const a = fireflies.actions;
  expect([a.list_meetings, a.get_meeting, a.ask, a.analytics].every((x) => x!.readOnly)).toBe(true);
  expect([a.delete_meeting, a.share_meeting, a.join_meeting, a.set_user_role, a.graphql_mutation].some((x) => x!.readOnly)).toBe(false);
});

test("a rejected key asks for reconnecting; other errors carry Fireflies' words", async () => {
  stub(null, [{ code: "auth_failed", message: "An error occurred while authenticating your request." }]);
  expect((await fails(run("me", {}))).expired).toBe(true);
  stub(null, [{ code: "object_not_found", message: "Transcript not found" }]);
  const e = await fails(run("get_meeting", { id: "nope" }));
  expect(e.message).toBe("Fireflies: Transcript not found");
  expect(e.expired).toBe(false);
});

test("raw queries refuse to change anything, before any request", async () => {
  const calls = stub({});
  expect(await fails(run("graphql_query", { query: "mutation { deleteTranscript(id: \"t1\") { id } }" }))).toBeInstanceOf(AppsError);
  expect(calls).toHaveLength(0);
});
