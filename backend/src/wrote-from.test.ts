import { afterAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { wroteFromPhone } from "./channels";
import { db } from "./db";
import { conversations, users, workspaces } from "./db/schema";

// against the local database: a throwaway business
const tag = crypto.randomUUID().slice(0, 8);
const [ws] = await db.insert(workspaces).values({ name: `wrote-from-test-${tag}` }).returning();
const [user] = await db.insert(users).values({ email: `wrote-from-test-${tag}@example.com` }).returning();
afterAll(async () => {
  await db.delete(workspaces).where(eq(workspaces.id, ws!.id));
  await db.delete(users).where(eq(users.id, user!.id));
});

test("what finishes later goes to the phone only if they last wrote from there", async () => {
  const id = crypto.randomUUID();
  await db.insert(conversations).values({ id, workspaceId: ws!.id, userId: user!.id, title: "main", kind: "main" });
  expect(await wroteFromPhone(id)).toBe(false);
  await db.update(conversations).set({ wroteFrom: "telegram" }).where(eq(conversations.id, id));
  expect(await wroteFromPhone(id)).toBe(true);
  await db.update(conversations).set({ wroteFrom: "web" }).where(eq(conversations.id, id));
  expect(await wroteFromPhone(id)).toBe(false);
  expect(await wroteFromPhone(crypto.randomUUID())).toBe(false);
});
