import { expect, test } from "bun:test";
import { replyChanged, siteOf } from "./site-calls";

test("a site is its registrable name, subdomains together", () => {
  expect(siteOf("app.getswipe.in")).toBe("getswipe.in");
  expect(siteOf("api.getswipe.in:443")).toBe("getswipe.in");
  expect(siteOf("books.zoho.co.in")).toBe("zoho.co.in");
  expect(siteOf("localhost")).toBe("localhost");
});

test("a reply counts as changed only when half or more of its fields went", () => {
  const was = ["id", "name", "total", "date"];
  expect(replyChanged(was, ["id", "name", "total", "date", "new"])).toBe(false);
  expect(replyChanged(was, ["id", "name", "total"])).toBe(false);
  expect(replyChanged(was, ["id", "name"])).toBe(true);
  expect(replyChanged(was, ["error"])).toBe(true);
  // a sign-in page where JSON used to come
  expect(replyChanged(was, null, true)).toBe(true);
  // an empty list, or nothing saved to compare with, says nothing
  expect(replyChanged(was, null)).toBe(false);
  expect(replyChanged(null, ["error"])).toBe(false);
  expect(replyChanged([], null, true)).toBe(false);
});
