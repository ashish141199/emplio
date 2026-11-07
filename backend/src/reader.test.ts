import { expect, test } from "bun:test";
import { lessonChanges, newPart } from "./reader";

const at = (min: number) => new Date(Date.UTC(2026, 9, 25, 10, min));
const m = (role: string, min: number) => ({ role, createdAt: at(min) });

test("a reader gets what came after its last read, with a little before it, only when the person said something", () => {
  const rows = [m("user", 0), m("assistant", 1), m("user", 2), m("assistant", 3)];
  expect(newPart(rows, null)).toEqual({ before: [], fresh: rows });
  expect(newPart(rows, at(1))).toEqual({ before: rows.slice(0, 2), fresh: rows.slice(2) });
  expect(newPart(rows, at(3))).toBeNull();
  // only the AI wrote since (a reminder sent to their channel): nothing new from the person
  expect(newPart([...rows, m("assistant", 4)], at(3))).toBeNull();
});

test("an agent's notes change only as the reply says: nothing that looks secret, nothing past the limit", () => {
  expect(lessonChanges("[SILENT]", 5)).toEqual({ add: [], drop: [] });
  expect(lessonChanges("+ Open the ledger by month first\n- 2\n- 9\nsome chatter", 5)).toEqual({ add: ["Open the ledger by month first"], drop: [2] });
  expect(lessonChanges("+ The password is hunter2\n+ Use the API key abc\n+ Save after each row", 0).add).toEqual(["Save after each row"]);
  expect(lessonChanges("+ a\n+ b\n+ c\n+ d", 0).add).toEqual(["a", "b", "c"]);
});
