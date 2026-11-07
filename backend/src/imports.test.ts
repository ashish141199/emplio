import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { claudeMade, parse } from "./imports";

test("Claude's export: memory files and the summary as notes, chats with their words", () => {
  const memory = { conversations_memory: "Runs Acme Traders", memory_files: [{ path: "/people/parth.md", content: "Dev" }] };
  const chats = [{ uuid: "c1", name: "Quote", chat_messages: [
    { sender: "human", text: "hi", created_at: "2025-01-01T10:00:00Z" },
    { sender: "assistant", text: "", content: [{ type: "text", text: "hello" }], created_at: "2025-01-01T10:00:01Z" },
  ] }];
  const p = parse("claude", [{ path: "memories/a.json", text: JSON.stringify(memory) }, { path: "conversations.json", text: JSON.stringify(chats) }]);
  expect(p.notes.map((n) => n.path)).toEqual(["summary.md", "people/parth.md"]);
  expect(p.chats[0]!.messages.map((m) => [m.role, m.text])).toEqual([["user", "hi"], ["assistant", "hello"]]);
});

test("ChatGPT's export: the chat as last shown, from the current message back to the start", () => {
  const mapping = {
    r: { parent: null, message: null },
    a: { parent: "r", message: { author: { role: "user" }, content: { parts: ["q"] }, create_time: 1700000000 } },
    old: { parent: "a", message: { author: { role: "assistant" }, content: { parts: ["edited away"] } } },
    b: { parent: "a", message: { author: { role: "assistant" }, content: { parts: ["answer"] } } },
  };
  const p = parse("chatgpt", [{ path: "conversations.json", text: JSON.stringify([{ id: "x", title: "T", current_node: "b", mapping }]) }]);
  expect(p.chats[0]!.messages.map((m) => m.text)).toEqual(["q", "answer"]);
  expect(p.chats[0]!.messages[0]!.at?.getFullYear()).toBe(2023);
});

test("Hermes: memory entries split on §, sessions from state.db; paths can't leave the folder", () => {
  const d = new Database(":memory:");
  d.run("create table sessions (id text, title text)");
  d.run("create table messages (id integer, session_id text, role text, content text, timestamp real)");
  d.run("insert into sessions values ('s1', 'Plan')");
  d.run("insert into messages values (1, 's1', 'user', 'go', 1700000000), (2, 's1', 'tool', 'x', 1700000001), (3, 's1', 'assistant', 'done', 1700000002)");
  const p = parse("hermes", [
    { path: "memories/MEMORY.md", text: "a\n§\nb" },
    { path: "../../etc/x.md", text: "y" },
    { path: "state.db", base64: Buffer.from(d.serialize()).toString("base64") },
  ]);
  expect(p.notes).toEqual([{ path: "memories/MEMORY.md", content: "a\n\nb" }, { path: "etc/x.md", content: "y" }]);
  expect(p.chats[0]!.messages.map((m) => m.text)).toEqual(["go", "done"]);
});

test("OpenClaw: a .jsonl transcript, one event a line", () => {
  const lines = [{ type: "session" }, { type: "message", message: { role: "user", content: [{ type: "text", text: "hey" }] } }].map((l) => JSON.stringify(l));
  const p = parse("openclaw", [{ path: "agents/main/sessions/abc.jsonl", text: lines.join("\n") }]);
  expect(p.chats[0]!.messages).toEqual([{ role: "user", text: "hey", at: undefined }]);
});

test("Claude's artifacts and files: replayed to how they ended, named by title and type", () => {
  const tool = (name: string, input: object) => ({ type: "tool_use", name, input });
  const made = claudeMade([
    { sender: "assistant", content: [tool("artifacts", { id: "q", command: "create", type: "text/markdown", title: "Quote for Ravi", content: "Total ₹500" })] },
    { sender: "assistant", content: [tool("artifacts", { id: "q", command: "update", old_str: "₹500", new_str: "₹450" })] },
    { sender: "assistant", content: [tool("artifacts", { id: "s", command: "create", type: "application/vnd.ant.code", language: "Python", title: "a/b", content: "print(1)" })] },
    { sender: "assistant", content: [tool("create_file", { path: "/mnt/out/plan.html", file_text: "<h1>Plan</h1>" })] },
  ]);
  expect(made).toEqual([
    { name: "Quote for Ravi.md", type: "text/markdown", content: "Total ₹450" },
    { name: "a-b.py", type: "text/plain", content: "print(1)" },
    { name: "plan.html", type: "text/html", content: "<h1>Plan</h1>" },
  ]);
});
