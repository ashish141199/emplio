import { expect, test } from "bun:test";
import type { ModelMessage, UIMessage } from "ai";
import { recentStart, trimOld } from "./compact";

const ask = (text: string, extra: object[] = []) => ({ id: text, role: "user", parts: [{ type: "text", text }, ...extra] }) as UIMessage;
const ran = (output: string) => ({ id: output.slice(0, 9), role: "assistant", parts: [{ type: "tool-bash", state: "output-available", toolCallId: "c", input: {}, output: { exitCode: 0, output } }] }) as unknown as UIMessage;
const outputOf = (m: UIMessage) => (m.parts[0] as unknown as { output: { output: string } }).output.output;

test("older turns are cut down ten at a time, the last three never", () => {
  const big = "x".repeat(10_000);
  const chat = (n: number) => Array.from({ length: n }, (_, i) => [ask(`q${i}`), ran(`${i}${big}`)]).flat();
  // 12 asks: nothing old enough yet
  expect(trimOld(chat(12))).toEqual(chat(12));
  // 13 asks: the first ten are cut, the last three are untouched
  const t = trimOld(chat(13));
  expect(outputOf(t[1]!).length).toBeLessThan(3_300);
  expect(outputOf(t[1]!)).toContain("characters of this older output left out");
  expect(t.slice(20)).toEqual(chat(13).slice(20));
  // the line doesn't move again until 23 asks, so what's sent before it stays the same
  expect(trimOld(chat(22)).slice(0, 20)).toEqual(t.slice(0, 20));
});

test("a repeated output keeps only its latest copy; old attachments become a pointer", () => {
  const same = "y".repeat(500);
  const chat = [ask("q0", [{ type: "file", url: "/files/a/b/photo.jpg", mediaType: "image/jpeg", filename: "photo.jpg" }]), ran(same), ask("q1"), ran(same), ...Array.from({ length: 11 }, (_, i) => ask(`r${i}`))];
  const t = trimOld(chat);
  expect(outputOf(t[1]!)).toBe("[Same output as a later run, shown there.]");
  expect(outputOf(t[3]!)).toBe(same);
  expect(t[0]!.parts[1]).toEqual({ type: "text", text: expect.stringContaining("/work/in/photo.jpg") });
});

test("a fold keeps the last few exchanges word for word, while they fit", () => {
  const turn = (q: string, size: number) => [
    { role: "user", content: q },
    { role: "assistant", content: [{ type: "tool-call", toolCallId: q, toolName: "bash", input: {} }] },
    { role: "tool", content: [{ type: "tool-result", toolCallId: q, toolName: "bash", output: { type: "text", value: "z".repeat(size) } }] },
  ];
  const chat = [...turn("a", 30), ...turn("b", 30), ...turn("c", 30), ...turn("d", 30), ...turn("e", 30), { role: "user", content: "now" }] as ModelMessage[];
  // the last three exchanges and the message being answered; a and b are folded
  expect(recentStart(chat, 20_000)).toBe(6);
  // a big one stops it: only what comes after it is kept
  const big = [...turn("a", 30), ...turn("b", 90_000), ...turn("c", 30), { role: "user", content: "now" }] as ModelMessage[];
  expect(recentStart(big, 20_000)).toBe(6);
  // never everything: something is always left to fold
  expect(recentStart(chat.slice(9), 20_000)).toBe(3);
});

test("a fold keeps the last few exchanges word for word, while they fit", () => {
  const turn = (q: string, size: number) => [
    { role: "user", content: q },
    { role: "assistant", content: [{ type: "tool-call", toolCallId: q, toolName: "bash", input: {} }] },
    { role: "tool", content: [{ type: "tool-result", toolCallId: q, toolName: "bash", output: { type: "text", value: "z".repeat(size) } }] },
  ];
  const chat = [...turn("a", 30), ...turn("b", 30), ...turn("c", 30), ...turn("d", 30), ...turn("e", 30), { role: "user", content: "now" }] as ModelMessage[];
  // the last three exchanges and the message being answered; a and b are folded
  expect(recentStart(chat, 20_000)).toBe(6);
  // a big one stops it: only what comes after it is kept
  const big = [...turn("a", 30), ...turn("b", 90_000), ...turn("c", 30), { role: "user", content: "now" }] as ModelMessage[];
  expect(recentStart(big, 20_000)).toBe(6);
  // never everything: something is always left to fold
  expect(recentStart(chat.slice(9), 20_000)).toBe(3);
});
