import { expect, test } from "bun:test";
import { hideSilent, workingDay } from "./heartbeat";

const m = (role: string, text: string) => ({ role, parts: [{ type: "text", text }] });

test("a round with nothing to say is hidden from the chat, its prompt too", () => {
  const rows = [m("user", "[Check-in] ..."), m("assistant", "[SILENT]"), m("user", "[Check-in] ..."), m("assistant", "Fly.io payment failed")];
  expect(hideSilent(rows)).toEqual(rows.slice(2));
});

test("the working day runs from the morning brief to an hour after the report", () => {
  expect(workingDay({ briefHour: "9", reportHour: "19" })).toEqual({ start: 9, end: 20, report: 19 });
  expect(workingDay({ briefHour: "7", reportHour: "21" })).toEqual({ start: 7, end: 22, report: 21 });
  expect(workingDay({ briefHour: "10", reportHour: "off" })).toEqual({ start: 10, end: 20, report: null });
});
