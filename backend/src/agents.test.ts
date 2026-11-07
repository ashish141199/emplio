import { expect, test } from "bun:test";
import { agentMd, flags, parseAgent, slugOf } from "./agents";

test("AGENT.md round-trips", () => {
  const a = { name: "Supplier Finder", description: "Finds suppliers. Use for: cheaper vendor", skills: ["web-research", "price-compare"], level: "strong" as const, archived: false, instructions: "Near first, then wider." };
  expect(parseAgent("supplier-finder", agentMd(a))).toEqual({ slug: "supplier-finder", ...a });
  expect(parseAgent("x", agentMd({ ...a, archived: true })).archived).toBe(true);
  // hand-written, quoted, no level: light
  expect(parseAgent("x", `---\nname: "X"\nskills: ["a", b]\n---\nDo it.`)).toMatchObject({ name: "X", skills: ["a", "b"], level: "light", instructions: "Do it." });
});

test("slugs and flags", () => {
  expect(slugOf("Supplier Finder!")).toBe("supplier-finder");
  expect(slugOf("agents/supplier-finder")).toBe("supplier-finder");
  expect(flags(["find", "--agent", "Supplier Finder", "brief", "--level", "strong"], ["agent", "level"])).toEqual({ set: { agent: "Supplier Finder", level: "strong" }, rest: ["find", "brief"] });
});
