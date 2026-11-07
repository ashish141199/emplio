import { expect, test } from "bun:test";
import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { authRoutes } from "./auth";
import { db } from "./db";
import { users } from "./db/schema";

const TOKEN = "a".repeat(64);

async function open(t: string) {
  process.env.SETUP_TOKEN = TOKEN;
  process.env.SETUP_EMAIL = `setup-${crypto.randomUUID()}@example.com`;
  const app = Fastify();
  await app.register(cookie);
  await app.register(authRoutes);
  const res = await app.inject({ method: "GET", url: `/auth/setup?t=${t}` });
  return { login: res.headers.location?.endsWith("/login"), cookie: res.headers["set-cookie"] };
}

test("the setup link signs in nobody with the wrong token, or once anyone exists", async () => {
  await db.insert(users).values({ email: `someone-${crypto.randomUUID()}@example.com` });
  for (const t of ["", "wrong", "b".repeat(64), TOKEN]) expect(await open(t)).toEqual({ login: true, cookie: undefined });
});
