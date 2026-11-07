// A business's memory of its sites' own requests. Browser work already spots them (CALLS_PY in sandbox.ts); they're
// kept here, shown once per reply when a site opens so Emplio can skip the clicking, and checked when repeated: a reply
// that no longer fits gets a warning, and the next time the page itself sends that request, the record is replaced.
// Addresses and field names only, never values or logins. No model involved.
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { siteCalls } from "./db/schema";

const SHOWN = 10;
const KEPT = 100; // per site, the latest
const LINE = 160;

const row = z.object({
  host: z.string().min(1).max(200),
  method: z.string().min(1).max(10),
  path: z.string().max(500),
  op: z.string().max(200),
  query: z.string().max(300),
  sends: z.string().max(500),
  returns: z.string().max(500),
  keys: z.array(z.string().max(50)).max(30).nullable(),
  notJson: z.boolean().optional(),
});
const report = z.object({ page: z.string().max(200).optional(), rows: z.array(row).max(15).optional(), sent: row.optional() });
type Row = z.infer<typeof row>;

// ponytail: the usual two-level endings, no public-suffix list; add one if a business's sites get lumped together
const TWO_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);
export function siteOf(host: string) {
  const parts = host.split(":")[0]!.toLowerCase().split(".");
  return parts.slice(parts.length >= 3 && parts.at(-1)!.length === 2 && TWO_LEVEL.has(parts.at(-2)!) ? -3 : -2).join(".");
}

// Half or more of last time's fields gone: an error, a sign-in page, or a site that changed. Nothing to compare (an
// empty list, no fields saved) says nothing.
export function replyChanged(was: string[] | null, now: string[] | null, notJson = false) {
  if (!was?.length) return false;
  if (notJson) return true;
  if (!now) return false;
  return was.filter((k) => !now.includes(k)).length * 2 >= was.length;
}

const lineOf = (c: Pick<Row, "host" | "method" | "path" | "op" | "query" | "sends" | "returns">, page?: string) =>
  `${c.method} ${c.host === page ? "" : `https://${c.host}`}${c.path}${c.query ? `?${c.query}` : ""}${c.op ? ` (${c.op})` : ""}${c.sends ? ` sends ${c.sends}` : ""}${c.returns ? ` returns ${c.returns}` : ""}`.slice(0, LINE);

const same = (workspaceId: string, c: Row) =>
  and(eq(siteCalls.workspaceId, workspaceId), eq(siteCalls.host, c.host), eq(siteCalls.method, c.method), eq(siteCalls.path, c.path), eq(siteCalls.op, c.op));

const fields = (c: Row) => ({ query: c.query, ...(c.sends && { sends: c.sends }), ...(c.returns && { returns: c.returns, keys: c.keys }), seenAt: new Date() });

export async function keep(workspaceId: string, c: Row) {
  const site = siteOf(c.host);
  await db
    .insert(siteCalls)
    .values({ workspaceId, site, host: c.host, method: c.method, path: c.path, op: c.op, query: c.query, sends: c.sends, returns: c.returns, keys: c.keys })
    .onConflictDoUpdate({ target: [siteCalls.workspaceId, siteCalls.host, siteCalls.method, siteCalls.path, siteCalls.op], set: fields(c) });
  await db.execute(sql`DELETE FROM site_calls WHERE workspace_id = ${workspaceId} AND site = ${site} AND ctid IN (
    SELECT ctid FROM site_calls WHERE workspace_id = ${workspaceId} AND site = ${site} ORDER BY seen_at DESC OFFSET ${KEPT})`);
}

// A request repeated by `emplio browser send`: never replaces what the page itself sent.
async function repeated(workspaceId: string, c: Row, canShow: boolean) {
  const [was] = await db.select().from(siteCalls).where(same(workspaceId, c)).limit(1);
  if (!was) {
    if (!c.notJson) await keep(workspaceId, c);
    return null;
  }
  if (replyChanged(was.keys, c.keys, c.notJson))
    return `[This reply doesn't look like last time${was.returns ? ` (it returned ${was.returns})` : ""}${c.returns ? `, now ${c.returns}` : ""}. The site may have changed or signed you out, so don't trust it. Do this once on the page: what the page sends is saved in place of the old one.${canShow ? " If you can't get it to work there, ask them to click Show Emplio how in the browser and do it once." : ""}]`;
  await db.update(siteCalls).set({ seenAt: new Date() }).where(same(workspaceId, c));
  return null;
}

// What a browser command reported (base64 JSON from inside the computer, so checked). Returns what to add to its output.
// canShow: someone's in the web app and could show Emplio how (browser-show.ts).
export async function siteCallsFrom(workspaceId: string, encoded: string, shown: Set<string>, canShow = false) {
  const got = report.safeParse(JSON.parse(Buffer.from(encoded, "base64").toString()));
  if (!got.success) return null;
  const { page, rows = [], sent } = got.data;
  for (const c of rows) await keep(workspaceId, c);
  const notes = sent ? [await repeated(workspaceId, sent, canShow)] : [];
  const site = page ? siteOf(page) : null;
  if (site && !shown.has(site)) {
    shown.add(site);
    const justNow = new Set(rows.map((c) => `${c.host} ${c.method} ${c.path} ${c.op}`));
    const known = (await db.select().from(siteCalls).where(and(eq(siteCalls.workspaceId, workspaceId), eq(siteCalls.site, site))).orderBy(desc(siteCalls.seenAt)).limit(SHOWN + rows.length))
      .filter((c) => !justNow.has(`${c.host} ${c.method} ${c.path} ${c.op}`))
      .slice(0, SHOWN);
    if (known.length) notes.push(`[Requests saved from earlier work on this site, repeat them with emplio browser send (all: emplio sites list ${site}):\n${known.map((c) => lineOf(c, page)).join("\n")}]`);
  }
  return notes.filter(Boolean).join("\n\n") || null;
}

const USAGE = "usage: emplio sites list [site] | emplio sites forget <site> [METHOD /path]. Requests are added and updated by themselves as you use a site's pages.";

// `emplio sites`
export async function sitesCommand(workspaceId: string, args: string[]) {
  const [verb, site, method, path] = args;
  if (verb === "list" && !site) {
    const sites = await db
      .select({ site: siteCalls.site, n: sql<number>`count(*)::int` })
      .from(siteCalls)
      .where(eq(siteCalls.workspaceId, workspaceId))
      .groupBy(siteCalls.site)
      .orderBy(siteCalls.site);
    return sites.length ? sites.map((s) => `${s.site}: ${s.n} saved`).join("\n") : "No requests saved yet.";
  }
  if (verb === "list" && site) {
    const calls = await db.select().from(siteCalls).where(and(eq(siteCalls.workspaceId, workspaceId), eq(siteCalls.site, siteOf(site)))).orderBy(desc(siteCalls.seenAt));
    return calls.length ? calls.map((c) => lineOf(c)).join("\n") : `No requests saved for ${site}.`;
  }
  if (verb === "forget" && site && !method) {
    const gone = await db.delete(siteCalls).where(and(eq(siteCalls.workspaceId, workspaceId), eq(siteCalls.site, siteOf(site)))).returning({ path: siteCalls.path });
    return `forgot ${gone.length} requests for ${site}`;
  }
  if (verb === "forget" && site && method && path) {
    const gone = await db
      .delete(siteCalls)
      .where(and(eq(siteCalls.workspaceId, workspaceId), eq(siteCalls.site, siteOf(site)), eq(siteCalls.method, method.toUpperCase()), eq(siteCalls.path, path.split("?")[0]!)))
      .returning({ path: siteCalls.path });
    return gone.length ? `forgot ${method.toUpperCase()} ${path}` : `error: no ${method.toUpperCase()} ${path} saved for ${site}`;
  }
  return USAGE;
}
