import { expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { adminContext, classify, namesIn, parseWhen, privateTables, readTable, refusedForStaff } from "./database";

test("tells reads, writes and schema changes apart", () => {
  expect(classify("select * from leads where note = 'drop table x'")).toBe("read");
  expect(classify("with t as (select 1) select * from t")).toBe("read");
  expect(classify("insert into leads (name) values ('a')")).toBe("write");
  expect(classify("create table leads (id integer primary key) strict")).toBe("schema");
  expect(classify("CREATE UNIQUE INDEX i on leads(email)")).toBe("schema");
  expect(classify("pragma table_info(leads)")).toBe("read");
  expect(classify("pragma foreign_keys = off")).toBe("forbidden");
  expect(classify("attach 'x.db' as x")).toBe("forbidden");
});

test("a quote in a comment can't hide a schema change", () => {
  expect(classify("-- it's\ndrop table leads; -- it's")).toBe("schema");
  expect(classify("select \"a'\" ; drop table leads; -- '")).toBe("schema");
  expect(classify("/* ' */ create table x (id integer); /* ' */")).toBe("schema");
  expect(classify("select * from leads where note = 'drop table x' -- drop table y")).toBe("read");
});

test("reads restore times", () => {
  const now = Date.parse("2026-10-22T10:00:00Z");
  expect(parseWhen("30 minutes ago", now)?.toISOString()).toBe("2026-10-22T09:30:00.000Z");
  expect(parseWhen("2 hours ago", now)?.toISOString()).toBe("2026-10-22T08:00:00.000Z");
  expect(parseWhen("2026-10-22T09:00:00Z", now)?.toISOString()).toBe("2026-10-22T09:00:00.000Z");
  expect(parseWhen("yesterday-ish", now)).toBeNull();
});

test("the Database tab pages, searches, filters and sorts real tables and nothing else", async () => {
  const client = createClient({ url: ":memory:" });
  await client.executeMultiple(`create table "my leads" (id integer primary key, name text, city text, photo blob);
    insert into "my leads" (name, city, photo) values ('Asha', 'Pune', x'0102'), (null, null, null), ('Ravi', 'Pune', null), ('100%', 'Delhi', null);`);
  for (let i = 0; i < 60; i++) await client.execute("insert into \"my leads\" (name, city) values ('x', 'Goa')");

  const first = await readTable(client, "my leads", {}, 0);
  expect(first.columns).toEqual(["id", "name", "city", "photo"]);
  expect(first.total).toBe(64);
  expect(first.rows.length).toBe(50);
  expect(first.rows[0]).toEqual([1, "Asha", "Pune", "<blob 2 bytes>"]);
  expect(first.rows[1]).toEqual([2, null, null, null]);
  expect((await readTable(client, "my leads", {}, 50)).rows.length).toBe(14);

  // search: every word, anywhere in the row, any case
  expect((await readTable(client, "my leads", { search: "pune ravi" }, 0)).rows.map((r) => r[1])).toEqual(["Ravi"]);
  // % is a character to look for, not a wildcard
  expect((await readTable(client, "my leads", { search: "%" }, 0)).rows.map((r) => r[1])).toEqual(["100%"]);
  // filter: only that column, and the total follows it
  const pune = await readTable(client, "my leads", { filters: { city: "pun" } }, 0);
  expect(pune.total).toBe(2);
  expect((await readTable(client, "my leads", { filters: { name: "pune" } }, 0)).total).toBe(0);
  // sort
  expect((await readTable(client, "my leads", { sort: "id", dir: "desc" }, 0)).rows[0]![0]).toBe(64);
  expect((await readTable(client, "my leads", { filters: { city: "pune" }, sort: "name" }, 0)).rows.map((r) => r[1])).toEqual(["Asha", "Ravi"]);

  // names that don't exist never reach the SQL; typed text can't break out of its parameter
  await expect(readTable(client, "sqlite_schema", {}, 0)).rejects.toThrow("No table");
  await expect(readTable(client, 'x"; drop table "my leads', {}, 0)).rejects.toThrow("No table");
  await expect(readTable(client, "my leads", { sort: 'id"; drop table "my leads' }, 0)).rejects.toThrow("No column");
  await expect(readTable(client, "my leads", { filters: { 'id" or 1=1 --': "x" } }, 0)).rejects.toThrow("No column");
  expect((await readTable(client, "my leads", { search: "'; drop table \"my leads\"; --" }, 0)).total).toBe(0);
  expect((await readTable(client, "my leads", {}, 0)).total).toBe(64);
});

test("the Database tab is for owners and admins", async () => {
  const sent: { code?: number; body?: unknown } = {};
  const reply = { code: (code: number) => ((sent.code = code), reply), send: (body: unknown) => ((sent.body = body), reply) } as never;
  const as = (role: string) => (async () => ({ role, workspaceId: "w", userId: "u" })) as never;

  expect(await adminContext({} as never, reply, as("member"))).toBeNull();
  expect(sent.code).toBe(403);
  sent.code = undefined;
  expect((await adminContext({} as never, reply, as("admin")))?.role).toBe("admin");
  expect((await adminContext({} as never, reply, as("owner")))?.role).toBe("owner");
  expect(sent.code).toBeUndefined();
  // not logged in: context has already answered
  expect(await adminContext({} as never, reply, (async () => null) as never)).toBeNull();
  expect(sent.code).toBeUndefined();
});

const table = (name: string) => ({ name, type: "table", sql: `create table ${name} (id integer)` });

test("tables are open unless sensitive by name or decided otherwise", () => {
  const all = ["customers", "orders", "api_keys", "apiKeys", "Staff_Salaries", "payroll", "hr_notes", "monkeys", "tokenized_items", "bank_accounts"].map(table);
  expect([...privateTables(all, {})].sort()).toEqual(["api_keys", "apikeys", "bank_accounts", "hr_notes", "payroll", "staff_salaries"]);
  // what someone decided wins, both ways
  const decided = privateTables(all, { api_keys: "staff", orders: "private" });
  expect(decided.has("api_keys")).toBe(false);
  expect(decided.has("orders")).toBe(true);
});

test("what would show a private table is private too", () => {
  const entries = [
    table("salaries"),
    table("salaries_fts_data"),
    table("customers"),
    { name: "pay_view", type: "view", sql: 'create view pay_view as select * from "SALARIES"' },
    { name: "pay_view2", type: "view", sql: "create view pay_view2 as select * from pay_view" },
    { name: "headcount", type: "view", sql: "create view headcount as select count(*) from salaries" },
  ];
  expect([...privateTables(entries, { headcount: "staff" })].sort()).toEqual(["pay_view", "pay_view2", "salaries", "salaries_fts_data"]);
});

test("a staff chat can't reach a private table however the statement is written", () => {
  const hidden = new Set(["api_keys", 'odd"name']);
  const tries = [
    "select * from api_keys",
    "SELECT * FROM API_KEYS",
    'select * from "api_keys"',
    "select * from `api_keys`",
    "select * from [api_keys]",
    "select * from 'api_keys'",
    "select * from main.api_keys",
    "select * from/**/api_keys",
    "with k as (select * from api_keys) select * from k",
    "select * from customers union select * from api_keys",
    "select (select key_hint from api_keys limit 1)",
    "insert into customers (name) select key_hint from api_keys",
    "delete from api_keys",
    "update api_keys set key_hint = ''",
    "select 1 -- '\n from api_keys -- '",
    "select 1 /* ' */ from api_keys /* ' */",
    'select * from "odd""name"',
    // what would list them or show how they're made
    "select name from sqlite_schema",
    "select sql from SQLITE_MASTER",
    "select * from 'sqlite_master'",
    "pragma table_list",
    "pragma table_info(customers)",
    "select * from pragma_table_info('api_' || 'keys')",
    "select * from dbstat",
    "select load_extension('x')",
  ];
  for (const sql of tries) expect([sql, refusedForStaff(sql, hidden) !== null]).toEqual([sql, true]);

  for (const sql of ["select * from customers", "select * from customers where note = 'our api keys'", "update customers set name = 'x'", "delete from orders where id = 1"])
    expect([sql, refusedForStaff(sql, hidden)]).toEqual([sql, null]);
  expect(namesIn("select 'it''s' from \"a\"\"b\"").has('a"b')).toBe(true);
});
