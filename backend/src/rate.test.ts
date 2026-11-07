import { expect, test } from "bun:test";
import { clearLimit, tooMany } from "./rate";

test("allows up to the limit, then refuses until the window ends", async () => {
  const key = `t-${crypto.randomUUID()}`;
  expect([tooMany(key, 2, 30), tooMany(key, 2, 30), tooMany(key, 2, 30)]).toEqual([false, false, true]);
  await Bun.sleep(40);
  expect(tooMany(key, 2, 30)).toBe(false);
});

test("clearing starts the count over, and keys don't share counts", () => {
  const key = `t-${crypto.randomUUID()}`;
  expect([tooMany(key, 1, 60_000), tooMany(key, 1, 60_000)]).toEqual([false, true]);
  expect(tooMany(`${key}-other`, 1, 60_000)).toBe(false);
  clearLimit(key);
  expect(tooMany(key, 1, 60_000)).toBe(false);
});
