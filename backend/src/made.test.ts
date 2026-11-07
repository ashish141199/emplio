import { afterAll, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { conversations, madeFiles, users, workspaceMembers, workspaces } from "./db/schema";
import { filesCommand, getMade, listMade, recordMade, shareMade, uploadRead } from "./made";

// against the local database: a throwaway business with an owner and a member
const tag = crypto.randomUUID().slice(0, 8);
const [ws] = await db.insert(workspaces).values({ name: `files-test-${tag}` }).returning();
const [owner, member] = await db.insert(users).values([{ email: `owner-${tag}@test.local` }, { email: `member-${tag}@test.local` }]).returning();
await db.insert(workspaceMembers).values([
  { workspaceId: ws!.id, userId: owner!.id, role: "owner" },
  { workspaceId: ws!.id, userId: member!.id, role: "member" },
]);
const [chat] = await db.insert(conversations).values({ id: crypto.randomUUID(), workspaceId: ws!.id, userId: member!.id, title: "Quote for Acme" }).returning();
const asOwner = { workspaceId: ws!.id, userId: owner!.id, role: "owner" as const };
const asMember = { workspaceId: ws!.id, userId: member!.id, role: "member" as const };
afterAll(async () => {
  // activity lines are written in the background: let them land before the business goes
  await Bun.sleep(100);
  await db.delete(workspaces).where(eq(workspaces.id, ws!.id));
  await db.delete(users).where(inArray(users.id, [owner!.id, member!.id]));
});

const pdf = (_: number) => ({ url: `/files/${ws!.id}/${crypto.randomUUID()}/quote.pdf`, filename: "quote.pdf", mediaType: "application/pdf" });

test("the same name in the same chat is the next version; search finds the words inside", async () => {
  const id = await recordMade(asMember, chat!.id, pdf(1), 100, "Acme Traders revised quote");
  const again = await recordMade(asMember, chat!.id, pdf(2), 120, "Acme Traders revised quote, 5% off");
  expect(again).toBe(id);
  const f = await getMade(asMember, id.slice(0, 8));
  expect(f?.version).toBe(2);
  expect(f?.conversationTitle).toBe("Quote for Acme");
  expect((await listMade(asMember, "acme trad")).map((x) => x.id)).toEqual([id]);
  expect(await listMade(asMember, "invoice")).toEqual([]);
});

test("a member sees only their own; the owner sees everyone's", async () => {
  await recordMade(asOwner, chat!.id, { ...pdf(3), filename: "payroll.xlsx" }, 10, "");
  expect((await listMade(asMember)).map((f) => f.name)).toEqual(["quote.pdf"]);
  expect((await listMade(asOwner)).length).toBe(2);
  expect(await filesCommand(asMember, chat!.id, ["show", (await listMade(asOwner))[0]!.id], async () => "")).toStartWith("error: no file");
});

test("sharing gives one link until it's unshared", async () => {
  const [f] = await listMade(asMember);
  const a = await shareMade(asMember, f!.id, true);
  const b = await shareMade(asMember, f!.id, true);
  expect("url" in a && a.url).toMatch(/\/s\/[0-9a-f]{32}$/);
  expect(b).toEqual(a);
  expect(await shareMade(asMember, f!.id, false)).toEqual({ url: null });
});

test("an attached file is its own file, never a version of one Emplio made, and gets its words later", async () => {
  // as recordUploads stores it (without asking storage for its size)
  const sent = { ...pdf(4), filename: "brief.pdf" };
  await db.insert(madeFiles).values({ workspaceId: ws!.id, userId: member!.id, conversationId: chat!.id, source: "upload", name: sent.filename, mediaType: sent.mediaType, url: sent.url, size: 50 });
  const made = await recordMade(asMember, chat!.id, { ...pdf(5), filename: "brief.pdf" }, 60, "");
  const uploads = await listMade(asMember, undefined, 200, "upload");
  expect(uploads.map((f) => [f.name, f.source, f.version])).toEqual([["brief.pdf", "upload", 1]]);
  expect((await listMade(asMember, undefined, 200, "made")).some((f) => f.id === made)).toBe(true);
  await uploadRead(ws!.id, sent.url, "Mansha Auto board brief");
  expect((await listMade(asMember, "mansha")).map((f) => f.source)).toEqual(["upload"]);
});
