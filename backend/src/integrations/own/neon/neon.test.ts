import { afterEach, expect, test } from "bun:test";
import { AppsError } from "../../types";
import { own } from "../index";

type Call = { method: string; url: URL; headers: Record<string, string>; body: any };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// records every request and answers with reply(call); anything unanswered is a test bug, not a trip to Neon
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

const run = (action: string, input: unknown) => own.run(`neon.${action}`, input, { externalId: "", secret: "napi_x" }, "owner");
const fails = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected it to fail");
    },
    (e: AppsError) => e,
  );

const URI = "postgresql://neondb_owner:pw@ep-cool-sun-123.us-east-2.aws.neon.tech/neondb?sslmode=require";

test("a spec call goes to the console API with the key as a bearer", async () => {
  const calls = stub(() => json({ branches: [] }));
  await run("list_project_branches", { project_id: "p1" });
  expect(calls[0]!.url.origin + calls[0]!.url.pathname).toBe("https://console.neon.tech/api/v2/projects/p1/branches");
  expect(calls[0]!.headers.Authorization).toBe("Bearer napi_x");
});

test("run_sql gets the connection string, then posts the query to the compute's SQL endpoint", async () => {
  const calls = stub((c) =>
    c.url.pathname.endsWith("/connection_uri")
      ? json({ uri: URI })
      : c.url.href === "https://api.us-east-2.aws.neon.tech/sql"
        ? json({ command: "SELECT", rowCount: 1, rows: [{ id: 1 }], fields: [{ name: "id" }] })
        : undefined,
  );
  const out = await run("run_sql", { project_id: "p1", query: "select id from t where x = $1", params: [5] });
  expect(calls[0]!.url.searchParams.get("database_name")).toBe("neondb");
  expect(calls[0]!.url.searchParams.get("role_name")).toBe("neondb_owner");
  expect(calls[1]!.headers["Neon-Connection-String"]).toBe(URI);
  expect(calls[1]!.headers.Authorization).toBeUndefined();
  expect(calls[1]!.body).toEqual({ query: "select id from t where x = $1", params: [5] });
  expect(out).toEqual({ command: "SELECT", rowCount: 1, columns: ["id"], rows: [{ id: 1 }] });
});

test("a SQL error comes back as Postgres said it", async () => {
  stub((c) => (c.url.pathname.endsWith("/connection_uri") ? json({ uri: URI }) : json({ message: 'relation "t" does not exist' }, 400)));
  const e = await fails(run("run_sql", { project_id: "p1", query: "select 1 from t" }));
  expect(e.message).toBe('Neon: relation "t" does not exist (400)');
});

test("a dead key asks to reconnect", async () => {
  stub(() => json({ message: "authentication required" }, 401));
  const e = await fails(run("list_projects", {}));
  expect(e.message).toContain("rejected the token");
});
