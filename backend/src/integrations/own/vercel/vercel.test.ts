import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { AppFile, AppsError } from "../../types";
import { own } from "../index";
import { vercel } from "./index";

type Call = { method: string; url: URL; headers: Record<string, string>; body: any };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// records every request and answers with reply(call); anything unanswered is a test bug, not a trip to Vercel
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

const run = (action: string, input: unknown) => own.run(`vercel.${action}`, input, { externalId: "", secret: "tok" }, "owner");
const fails = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected it to fail");
    },
    (e: AppsError) => e,
  );

test("path, query and body fields each go to their place, and nothing else is sent", async () => {
  const calls = stub(() => json({ id: "prj_1" }));
  await run("create_project", { name: "shop", framework: "nextjs", teamId: "team_1" });
  expect(calls[0]!.method).toBe("POST");
  expect(calls[0]!.url.href).toBe("https://api.vercel.com/v11/projects?teamId=team_1");
  expect(calls[0]!.body).toEqual({ name: "shop", framework: "nextjs" });
  expect(calls[0]!.headers.Authorization).toBe("Bearer tok");
});

test("a body field named like a query param travels as body_<name>", async () => {
  const calls = stub(() => json({ id: "ecfg_1" }));
  await run("create_edge_config", { slug: "team-slug", body_slug: "my-config" });
  expect(calls[0]!.url.searchParams.get("slug")).toBe("team-slug");
  expect(calls[0]!.body).toEqual({ slug: "my-config" });
});

test("a body that isn't a plain object is sent whole", async () => {
  const calls = stub(() => json({ created: [] }));
  const env = { key: "API_KEY", value: "x", type: "encrypted", target: ["production"] };
  await run("create_project_env", { idOrName: "shop", body: env });
  expect(calls[0]!.url.pathname).toBe("/v10/projects/shop/env");
  expect(calls[0]!.body).toEqual(env);
});

test("listing env vars never decrypts them; reading one asks first", async () => {
  expect(JSON.stringify((await own.getAction("vercel.filter_project_envs"))!.input)).not.toContain("decrypt");
  expect(vercel.actions.filter_project_envs!.readOnly).toBe(true);
  expect(vercel.actions.get_project_env!.readOnly).toBe(false);
  expect(vercel.actions.get_domain_auth_code!.readOnly).toBe(false);
  expect(vercel.actions.search_domains!.readOnly).toBe(true);
  expect(vercel.actions.delete_project!.readOnly).toBe(false);
});

test("a file upload sends the bytes with their SHA1 worked out", async () => {
  const calls = stub(() => json({ urls: [] }));
  const bytes = new TextEncoder().encode("hello");
  await run("upload_file", { file: new AppFile("index.html", "text/html", bytes) });
  expect(calls[0]!.headers["x-vercel-digest"]).toBe(createHash("sha1").update(bytes).digest("hex"));
  expect(calls[0]!.headers["Content-Type"]).toBe("application/octet-stream");
  expect(calls[0]!.body).toEqual(bytes);
});

test("streamed logs come back as lines", async () => {
  stub(() => new Response('{"message":"GET /"}\n{"message":"200"}\n', { headers: { "content-type": "application/stream+json" } }));
  expect(await run("get_runtime_logs", { projectId: "prj_1", deploymentId: "dpl_1" })).toEqual({
    lines: [{ message: "GET /" }, { message: "200" }],
    more: undefined,
  });
});

test("a download comes back as a file", async () => {
  stub(() => new Response(new Uint8Array([1, 2]), { headers: { "content-type": "application/octet-stream" } }));
  const out = await run("download_artifact", { hash: "abc" });
  expect(out).toBeInstanceOf(AppFile);
  expect((out as AppFile).bytes).toEqual(new Uint8Array([1, 2]));
});

test("a dead token asks for reconnecting; other failures carry Vercel's words", async () => {
  stub(() => json({ error: { code: "forbidden", message: "Not authorized", invalidToken: true } }, 403));
  expect((await fails(run("get_projects", {}))).expired).toBe(true);
  stub(() => json({ error: { code: "not_found", message: "Project not found" } }, 404));
  const e = await fails(run("get_project", { idOrName: "nope" }));
  expect(e.message).toBe("Vercel: Project not found (404)");
  expect(e.expired).toBe(false);
});

test("bad input is refused before any request", async () => {
  const calls = stub(() => json({}));
  expect(await fails(run("create_project", { framework: "nextjs" }))).toBeInstanceOf(AppsError);
  expect(calls).toHaveLength(0);
});
