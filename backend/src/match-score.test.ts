import { FUZZY, matchScore, NO_MATCH } from "@emplio/shared";
import { expect, test } from "bun:test";

test("proper matches rank as before", () => {
  expect(matchScore("runmind", "", "")).toBe(0);
  expect(matchScore("runmind", "", "run")).toBe(0);
  expect(matchScore("swipe-bookkeeping", "", "book")).toBe(1);
  expect(matchScore("runmind", "", "mind")).toBe(2);
  expect(matchScore("x", "Create Runmind flows", "flows")).toBe(3);
});

test("letters in order find it", () => {
  expect(matchScore("runmind", "", "rnmd")).toBe(FUZZY);
  expect(matchScore("Swipe bookkeeping", "", "swbk")).toBe(FUZZY);
});

test("a small typo finds it", () => {
  expect(matchScore("runmind", "", "runmidn")).toBeGreaterThanOrEqual(FUZZY);
  expect(matchScore("runmind", "", "runmimd")).toBeGreaterThanOrEqual(FUZZY);
  expect(matchScore("Swipe bookkeeping", "", "bokkeeping")).toBeGreaterThanOrEqual(FUZZY);
  expect(matchScore("runmind", "", "runmoxdy")).toBe(NO_MATCH);
});

test("too little typed, or nothing like it, is no match", () => {
  expect(matchScore("runmind", "", "rm")).toBe(NO_MATCH);
  expect(matchScore("gmail", "", "slack")).toBe(NO_MATCH);
  // letters scattered across a long name aren't what was meant
  expect(matchScore("a very long file about rockets and also magic.md", "", "arm")).toBe(NO_MATCH);
});

test("fuzzy never looks in the description", () => {
  expect(matchScore("x", "runmind", "rnmd")).toBe(NO_MATCH);
});
