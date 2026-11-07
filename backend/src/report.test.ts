import { expect, test } from "bun:test";
import { convertToModelMessages, type UIMessage } from "ai";
import { isReport } from "@emplio/shared";
import { mailDue } from "./activity";

test("while a computer is down, one email per business every ten minutes", () => {
  const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
  expect(mailDue(a, 1_000_000)).toBe(true);
  expect(mailDue(a, 1_000_000 + 60_000)).toBe(false);
  expect(mailDue(b, 1_000_000 + 60_000)).toBe(true);
  expect(mailDue(a, 1_000_000 + 10 * 60_000)).toBe(true);
});

test("a report is spotted whatever comes after it, and only as the command itself", () => {
  expect(isReport(`emplio report "x" <<'EOF'\ny\nEOF`)).toBe(true);
  expect(isReport(`  emplio report "x"`)).toBe(true);
  expect(isReport(`cat emplio report`)).toBe(false);
  expect(isReport(undefined)).toBe(false);
});

test("an old chat whose only step was the old report tool still converts once that step is left out", async () => {
  const parts = [{ type: "tool-report_problem", toolCallId: "a", state: "output-available", input: {}, output: {} }, { type: "text", text: "Done." }];
  const left = (p: { type: string }[]) => p.filter((x) => x.type !== "tool-report_problem");
  const chat = (p: unknown[]): UIMessage[] => [
    { id: "1", role: "user", parts: [{ type: "text", text: "hi" }] },
    { id: "2", role: "assistant", parts: p as UIMessage["parts"] },
  ];
  expect((await convertToModelMessages(chat(left(parts)))).at(-1)).toMatchObject({ role: "assistant" });
  // only that step, nothing said: no empty message goes to the model
  expect((await convertToModelMessages(chat(left(parts.slice(0, 1))))).filter((m) => m.role === "assistant" && !m.content.length)).toEqual([]);
});
