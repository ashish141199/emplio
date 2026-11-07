import { expect, test } from "bun:test";
import { CATALOG } from "./catalog";
import { availableApps } from "./index";

test("with no Composio account, every app with a pasted key is still offered, and no Composio app is", async () => {
  delete process.env.COMPOSIO_API_KEY;
  const offered = (await availableApps()).map((a) => a.app).sort();
  expect(offered).toEqual(CATALOG.filter((a) => a.provider === "own").map((a) => a.app).sort());
  expect(offered).toContain("razorpay");
  expect(offered).not.toContain("gmail");
});
