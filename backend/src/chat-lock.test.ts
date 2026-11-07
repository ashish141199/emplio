import { expect, test } from "bun:test";
import { holdChat, quiet } from "./chat";

test("one at a time per chat, in the order they asked; other chats don't wait", async () => {
  const order: string[] = [];
  const first = await holdChat("a");
  const second = holdChat("a").then((release) => (order.push("second"), release));
  const other = holdChat("b").then((release) => (order.push("other"), release));
  await other.then((r) => r());
  expect(order).toEqual(["other"]);
  order.push("first done");
  first();
  (await second)();
  await quiet("a");
  expect(order).toEqual(["other", "first done", "second"]);
});
