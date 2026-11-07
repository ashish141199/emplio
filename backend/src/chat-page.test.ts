import { expect, test } from "bun:test";
import { forScreen, pageStart } from "./chat";

test("a page starts on someone's message, so a prompt and its reply stay together", () => {
  const path = ["user", "assistant", "assistant", "user", "assistant", "assistant"].map((role) => ({ role }));
  expect(pageStart(path, 6, 2)).toBe(3);
  expect(pageStart(path, 3, 2)).toBe(0);
  expect(pageStart(path, 6, 100)).toBe(0);
});

test("the screen gets no reasoning or provider data, and long logs only on request", () => {
  const long = "x".repeat(501);
  const [text, tool, small] = forScreen("m1", [
    { type: "reasoning", text: "hidden" },
    { type: "text", text: "hi", providerMetadata: { big: 1 } },
    { type: "tool-bash", toolCallId: "a", input: { command: long, description: "d" }, output: { output: long, exitCode: 0, plan: [1] }, callProviderMetadata: { big: 1 }, resultProviderMetadata: { big: 1 } },
    { type: "tool-bash", toolCallId: "b", input: { command: "ls" }, output: { output: "ok" } },
  ]) as Record<string, any>[];
  expect(text).toEqual({ type: "text", text: "hi" });
  expect(tool!.cut).toBe("m1");
  expect(tool!.input).toEqual({ command: `${"x".repeat(500)}…`, description: "d" });
  expect(tool!.output.output).toBeUndefined();
  // what the chat draws from a command stays
  expect(tool!.output.exitCode).toBe(0);
  expect(tool!.output.plan).toEqual([1]);
  expect(tool!.callProviderMetadata).toBeUndefined();
  expect(tool!.resultProviderMetadata).toBeUndefined();
  expect(small).toEqual({ type: "tool-bash", toolCallId: "b", input: { command: "ls" }, output: { output: "ok" } });
});
