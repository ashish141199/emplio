import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {
  AuthStartRequest,
  AuthStartResponse,
  AuthVerifyRequest,
  MeResponse,
  SetNameRequest,
} from "@emplio/shared";
import { db } from "./db";
import { loginCodes, sessions, users, workspaceMembers, workspaces } from "./db/schema";
import { cloud } from "./cloud";
import { sendEmail } from "./mail";
import { clearLimit, tooMany } from "./rate";

const COOKIE = "session";
const SESSION_DAYS = 30;
const CODE_MINUTES = 10;
const MAX_TRIES = 5;
// On a laptop this is the code, unmailed, for anyone reaching it from this machine or the local network.
// Never on production, and never through the tunnel (cloudflared adds cf-connecting-ip; its socket is localhost).
const DEV_OTP = "123456";
// 123456 only where someone asked for it on purpose (dev.sh sets DEV_LOGIN=1), never just because a setting is missing
const devLogin = () => process.env.DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";
const devCodes = () => devLogin() && !process.env.RESEND_API_KEY;
const localRequest = (req: FastifyRequest) =>
  devLogin() &&
  !req.headers["cf-connecting-ip"] &&
  /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|f[cd]|fe80:)/i.test(req.ip.replace(/^::ffff:/, ""));

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const findUser = (email: string) => db.query.users.findFirst({ where: eq(users.email, email) });

export const emailSchema = { type: "string", format: "email", maxLength: 254 } as const;

export async function currentUser(req: FastifyRequest) {
  const token = req.cookies[COOKIE];
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, workspaceId: sessions.workspaceId, tokenHash: sessions.tokenHash })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hash(token)), gt(sessions.expiresAt, new Date())));
  return row ?? null;
}

// Every business they're on, the one this sign-in has open first (else the first they joined).
async function workspacesOf(user: { id: string; workspaceId: string | null }) {
  const ws = await db
    .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, user.id))
    .orderBy(asc(workspaceMembers.createdAt));
  const open = ws.findIndex((w) => w.id === user.workspaceId);
  return open > 0 ? [ws[open]!, ...ws.filter((_, i) => i !== open)] : ws;
}

async function startSession(reply: FastifyReply, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ tokenHash: hash(token), userId, expiresAt });
  reply.setCookie(COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // production on a plain http address (a self-hosted install on localhost) couldn't keep it otherwise
    secure: process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL?.startsWith("http:"),
    expires: expiresAt,
  });
}

export type Ctx = {
  userId: string;
  userName: string;
  userEmail: string;
  workspaceId: string;
  workspaceName: string;
  role: "owner" | "admin" | "member";
};

export async function context(req: FastifyRequest, reply: FastifyReply): Promise<Ctx | null> {
  const ctx = await contextOf(req);
  if (typeof ctx === "string") {
    reply.code(ctx === "No workspace" ? 403 : 401).send({ error: ctx });
    return null;
  }
  return ctx;
}

// The same, as of now, for a socket that stays open across a switch of business (chat.ts): the reason when there's none
export async function contextOf(req: FastifyRequest): Promise<Ctx | "Not logged in" | "No workspace"> {
  const user = await currentUser(req);
  if (!user?.name) return "Not logged in";
  const [ws] = await workspacesOf(user);
  if (!ws) return "No workspace";
  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    workspaceId: ws.id,
    workspaceName: ws.name,
    role: ws.role,
  };
}


// Sign-in limits, on top of the tries each code gets. By address, so one machine can't work through many people;
// by email, so many machines can't work through one person, and asking for a new code doesn't buy more guesses.
const HOUR = 3_600_000;
export const SLOW_DOWN = "Too many tries. Wait a while and try again.";
export const limited = (req: FastifyRequest, what: string, email: string, perAddress: number, perEmail: number) =>
  !localRequest(req) && (tooMany(`${what}:ip:${req.ip}`, perAddress, HOUR) || tooMany(`${what}:email:${email}`, perEmail, HOUR));

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: AuthStartRequest }>(
    "/auth/start",
    {
      schema: {
        body: {
          type: "object",
          required: ["email"],
          properties: { email: emailSchema },
        },
      },
    },
    async (req, reply) => {
      const email = normalizeEmail(req.body.email);
      if (limited(req, "start", email, 30, 6)) return reply.code(429).send({ error: SLOW_DOWN });
      const user = await findUser(email);
      // Closed: the first person to sign up owns this install, everyone after that is added from the team page.
      if (!user && process.env.SIGNUPS_CLOSED === "1" && (await db.query.users.findFirst({ columns: { id: true } })))
        return reply.code(403).send({ error: "This Emplio is invite-only. Ask its owner to add you to the team." });
      const res: AuthStartResponse = { isNewUser: !user };
      // on a laptop's own network nothing is mailed: the code is 123456
      if (devCodes() || localRequest(req)) {
        req.log.warn(`Not emailed: the sign-in code for ${email} is ${DEV_OTP}`);
        return res;
      }

      // a code asked for under a minute ago is still on its way; don't send a second
      const open = await db.query.loginCodes.findFirst({ where: eq(loginCodes.email, email) });
      if (open && open.expiresAt.getTime() - Date.now() > (CODE_MINUTES - 1) * 60_000) return res;

      const fixed = cloud.fixedCode(email);
      const code = fixed ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
      const row = { codeHash: hash(code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000), tries: 0 };
      await db.insert(loginCodes).values({ email, ...row }).onConflictDoUpdate({ target: loginCodes.email, set: row });
      // a fixed code isn't mailed
      if (fixed) return res;
      // no email service set up: whoever runs this server reads the code from its log
      if (!process.env.RESEND_API_KEY) {
        req.log.warn(`Not emailed (no RESEND_API_KEY): the sign-in code for ${email} is ${code}`);
        return res;
      }
      const sent = await sendEmail(
        email,
        `${code} is your Emplio code`,
        `Your sign-in code is ${code}. It works for ${CODE_MINUTES} minutes.\n\nIf you didn't ask to sign in, ignore this.`,
      );
      if (!sent) {
        // a code nobody received would block the next ask for a minute
        await db.delete(loginCodes).where(eq(loginCodes.email, email));
        return reply.code(400).send({ error: "We couldn't email that address. Check it, or try again in a minute." });
      }
      return res;
    },
  );

  app.post<{ Body: AuthVerifyRequest }>(
    "/auth/verify",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "code"],
          properties: {
            email: emailSchema,
            code: { type: "string", maxLength: 12 },
          },
        },
      },
    },
    async (req, reply) => {
      const email = normalizeEmail(req.body.email);
      const code = req.body.code.trim();
      if (limited(req, "verify", email, 60, 15)) return reply.code(429).send({ error: SLOW_DOWN });
      if (code === DEV_OTP && localRequest(req)) {
        // let through
      } else if (devCodes()) {
        if (code !== DEV_OTP) return reply.code(401).send({ error: "Invalid code" });
      } else {
        // count the try before checking it, in one step, so guessing runs out either way, even all at once
        const [row] = await db
          .update(loginCodes)
          .set({ tries: sql`${loginCodes.tries} + 1` })
          .where(and(eq(loginCodes.email, email), gt(loginCodes.expiresAt, new Date()), lt(loginCodes.tries, MAX_TRIES)))
          .returning();
        if (!row) return reply.code(401).send({ error: "That code has expired. Ask for a new one." });
        if (row.tries >= MAX_TRIES) await db.delete(loginCodes).where(eq(loginCodes.email, email));
        if (!timingSafeEqual(Buffer.from(hash(code)), Buffer.from(row.codeHash)))
          return reply.code(401).send({ error: "Invalid code" });
        await db.delete(loginCodes).where(eq(loginCodes.email, email));
      }
      clearLimit(`verify:email:${email}`);

      // onConflictDoNothing guards two verifies racing for the same new email
      await db.insert(users).values({ email }).onConflictDoNothing();
      const user = (await findUser(email))!;

      await startSession(reply, user.id);
      return reply.send({ ok: true });
    },
  );

  // A new self-hosted install: the link its setup printed signs in its first person, with no code. Once anyone
  // exists it does nothing. Never set on Emplio Cloud, so there it does nothing either.
  app.get<{ Querystring: { t?: string } }>("/auth/setup", async (req, reply) => {
    const frontend = process.env.FRONTEND_URL ?? "http://localhost:3000";
    const want = Buffer.from(process.env.SETUP_TOKEN ?? "");
    const given = Buffer.from(req.query.t ?? "");
    const email = process.env.SETUP_EMAIL;
    const valid = email && want.length >= 32 && given.length === want.length && timingSafeEqual(given, want);
    if (!valid || (await db.query.users.findFirst({ columns: { id: true } }))) return reply.redirect(`${frontend}/login`);
    const [user] = await db.insert(users).values({ email: normalizeEmail(email) }).returning();
    await startSession(reply, user!.id);
    return reply.redirect(frontend);
  });

  app.get("/auth/me", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Not logged in" });
    return { user: { id: user.id, email: user.email, name: user.name }, workspaces: await workspacesOf(user) } satisfies MeResponse;
  });

  // Onboarding: new users set their name once, which also creates their first workspace.
  app.post<{ Body: SetNameRequest }>(
    "/me/name",
    {
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string", minLength: 1, maxLength: 100 } },
        },
      },
    },
    async (req, reply) => {
      const user = await currentUser(req);
      if (!user) return reply.code(401).send({ error: "Not logged in" });
      const name = req.body.name.trim();
      if (!name) return reply.code(400).send({ error: "Name is required" });

      await db.transaction(async (tx) => {
        await tx.update(users).set({ name }).where(eq(users.id, user.id));
        const existing = await tx
          .select()
          .from(workspaceMembers)
          .where(eq(workspaceMembers.userId, user.id))
          .limit(1);
        if (existing.length) return;
        const [w] = await tx.insert(workspaces).values({ name: `${name}'s workspace` }).returning();
        await tx.insert(workspaceMembers).values({ workspaceId: w!.id, userId: user.id, role: "owner" });
      });
      return { ok: true };
    },
  );

  // Another business: a new one they own, or one they're already on. Only this sign-in moves; their phone
  // has its own (/switch).
  app.post<{ Body: { name: string } }>(
    "/workspaces",
    { schema: { body: { type: "object", required: ["name"], properties: { name: { type: "string", minLength: 1, maxLength: 100 } } } } },
    async (req, reply) => {
      const user = await currentUser(req);
      if (!user?.name) return reply.code(401).send({ error: "Not logged in" });
      const name = req.body.name.trim();
      if (!name) return reply.code(400).send({ error: "Name is required" });
      const w = await db.transaction(async (tx) => {
        const [w] = await tx.insert(workspaces).values({ name }).returning();
        await tx.insert(workspaceMembers).values({ workspaceId: w!.id, userId: user.id, role: "owner" });
        await tx.update(sessions).set({ workspaceId: w!.id }).where(eq(sessions.tokenHash, user.tokenHash));
        return w!;
      });
      return { id: w.id };
    },
  );

  // renaming a business (the welcome page's first step): its owner or an admin
  app.patch<{ Params: { id: string }; Body: { name: string } }>(
    "/workspaces/:id",
    { schema: { body: { type: "object", required: ["name"], properties: { name: { type: "string", minLength: 1, maxLength: 100 } } } } },
    async (req, reply) => {
      const user = await currentUser(req);
      if (!user) return reply.code(401).send({ error: "Not logged in" });
      const w = (await workspacesOf(user)).find((w) => w.id === req.params.id);
      if (!w) return reply.code(404).send({ error: "Not found" });
      if (w.role === "member") return reply.code(403).send({ error: "Only the owner or an admin can rename the business" });
      const name = req.body.name.trim();
      if (!name) return reply.code(400).send({ error: "Name is required" });
      await db.update(workspaces).set({ name }).where(eq(workspaces.id, w.id));
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>("/workspaces/:id/open", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Not logged in" });
    if (!(await workspacesOf(user)).some((w) => w.id === req.params.id)) return reply.code(404).send({ error: "Not found" });
    await db.update(sessions).set({ workspaceId: req.params.id }).where(eq(sessions.tokenHash, user.tokenHash));
    return { ok: true };
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[COOKIE];
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hash(token)));
    return reply.clearCookie(COOKIE, { path: "/" }).send({ ok: true });
  });
}
