import { expect, test } from "bun:test";
import { blocked, safety } from "./skill-store";

test("two scanners rating it high risk block a skill; one is shown on the card instead", () => {
  expect(blocked({ ath: { risk: "high" }, snyk: { risk: "critical" } })).toBe(true);
  expect(blocked({ ath: { risk: "safe" }, socket: { risk: "safe" }, snyk: { risk: "critical" } })).toBe(false);
  expect(safety({ ath: { risk: "safe" }, socket: { risk: "safe" }, snyk: { risk: "critical" } })).toBe("1 of 3 scanners flag critical risk");
  expect(safety(null)).toBe("not checked by the store's scanners");
});
