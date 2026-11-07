import { expect, test } from "bun:test";
import { callRow, masked, requestLine, sayLine, showFile, stepLine, worthKeeping } from "./browser-show";

test("a saved request keeps names, never values", () => {
  const row = callRow({
    url: "https://app.example.com/api/workspaces/5f0c2a7e-3b1d-4c8e-9a64-2d7f1e8b0c53/flows?page=2",
    method: "POST",
    sent: '{"name":"Secret Co","ownerId":"abc"}',
    reply: '{"id":"x1","name":"Secret Co"}',
  });
  expect(row).toEqual({
    host: "app.example.com",
    method: "POST",
    path: "/api/workspaces/*/flows",
    op: "",
    query: "page=",
    sends: "{name, ownerId}",
    returns: "{id, name}",
    keys: ["id", "name"],
  });
  expect(JSON.stringify(row)).not.toContain("Secret");
});

test("saves stand out from reads, and a read's reply stays short", () => {
  const long = "x".repeat(2000);
  expect(requestLine({ url: "https://a.com/api/me", method: "GET", status: 200, reply: long }).length).toBeLessThan(360);
  const saved = requestLine({ url: "https://a.com/api/flows", method: "POST", status: 201, sent: '{"name":"T"}', reply: long });
  expect(saved).toStartWith("PAGE SAVED: POST a.com/api/flows 201");
  expect(saved.length).toBeGreaterThan(1500);
});

test("what was said lands where it was said, even though it arrives late", () => {
  const file = showFile([
    { at: 0, line: "On page: https://a.com" },
    { at: 9000, line: 'Clicked button "Save"' },
    { at: 4000, line: sayLine("first fill the amount") },
    { at: 8000, line: sayLine(null) },
  ]);
  expect(file.split("\n")).toEqual([
    "1. On page: https://a.com",
    '2. Said: "first fill the amount"',
    "3. Said something here that couldn't be made out",
    '4. Clicked button "Save"',
  ]);
});

test("secrets never reach the recording", () => {
  expect(masked('{"password":"hunter2","amount":5}')).toBe('{"password":"***","amount":5}');
  expect(stepLine({ type: "fill", name: "Password", value: null })).toBe('Filled "Password" with (hidden)');
  const line = requestLine({ url: "https://a.com/auth/login", method: "POST", status: 200, sent: "user=x", reply: "welcome" });
  expect(line).toBe("PAGE SAVED: POST a.com/auth/login 200");
});

test("a request keeps what it sent and got back", () => {
  const line = requestLine({ url: "https://a.com/api/pay?id=4", method: "POST", status: 201, sent: '{"amount":5}', reply: '{"ok":true}' });
  expect(line).toContain("POST a.com/api/pay?id=4 201");
  expect(line).toContain('sent: {"amount":5}');
  expect(line).toContain('reply: {"ok":true}');
});

test("only the page's own useful requests are kept", () => {
  const base = { type: "Fetch", url: "https://api.a.com/x", page: "https://app.a.com/", method: "POST", status: 200, mime: "text/plain" };
  expect(worthKeeping(base)).toBe(true);
  expect(worthKeeping({ ...base, url: "https://analytics.b.com/x" })).toBe(false);
  expect(worthKeeping({ ...base, method: "GET" })).toBe(false);
  expect(worthKeeping({ ...base, method: "GET", mime: "application/json" })).toBe(true);
  expect(worthKeeping({ ...base, status: 500 })).toBe(false);
  expect(worthKeeping({ ...base, type: "Image" })).toBe(false);
});

test("a saved request never takes plain text for field names", () => {
  const row = callRow({ url: "https://app.test/api/note", method: "POST", sent: "Secret Co", reply: "<html>signed out</html>" });
  expect(row.sends).toBe("");
  expect(row.returns).toBe("");
  expect(row.keys).toBeNull();
});

test("requests to another company's .co.in server aren't the page's own", () => {
  const r = { type: "Fetch", method: "POST", status: 200, mime: "application/json" };
  expect(worthKeeping({ ...r, url: "https://api.acme.co.in/x", page: "https://app.acme.co.in/" })).toBe(true);
  expect(worthKeeping({ ...r, url: "https://tracker.co.in/x", page: "https://app.acme.co.in/" })).toBe(false);
});
