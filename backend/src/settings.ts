// A business's settings for how its AI employee behaves (the list is SETTING_FIELDS in shared). Stored on
// the workspace as only what was changed; read once per reply, so a change applies from the next message.
import { KEY_MASK, SETTING_FIELDS, type Settings, type SettingsResponse } from "@emplio/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { context } from "./auth";
import { db } from "./db";
import { record } from "./activity";
import { workspaces } from "./db/schema";
import { customModelProblem, listModels } from "./models";
import { decrypt, encrypt } from "./secrets";

// the env vars these used to be still move the defaults, for every business
const env = process.env;
export const DEFAULTS = {
  ...(Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, f.default])) as Settings),
  ...(Number(env.COMPACT_AT_TOKENS) && { compactAt: Number(env.COMPACT_AT_TOKENS) }),
  ...(env.VISUAL_REPLIES && { visualReplies: env.VISUAL_REPLIES === "true" }),
} satisfies Settings;

// A stored value that no longer fits its field (the list changed) falls back to the default.
const check = (key: string, value: unknown): string | null => {
  const f = SETTING_FIELDS.find((f) => f.key === key);
  if (!f) return `There's no setting called "${key}".`;
  if (f.type === "number")
    return typeof value === "number" && Number.isInteger(value) && value >= f.min && value <= f.max
      ? null
      : `${f.label}: pick a whole number from ${f.min.toLocaleString()} to ${f.max.toLocaleString()}.`;
  if (f.type === "toggle") return typeof value === "boolean" ? null : `${f.label}: must be on or off.`;
  if (f.type === "key") return typeof value === "string" && value.length <= 500 && !value.startsWith(KEY_MASK) ? null : `${f.label}: paste the whole key.`;
  // only the shape here: whether OpenRouter still offers it is checked on save (a model it drops later
  // fails that reply with OpenRouter's own error rather than silently switching brains)
  if (f.type === "model") return value === "auto" || (typeof value === "string" && /^[\w.-]+\/[\w.:-]+$/.test(value)) ? null : `${f.label}: not a model.`;
  // the env default may be a model not offered on the list
  return f.options.some((o) => o.value === value) || value === DEFAULTS[f.key] ? null : `${f.label}: not one of the choices.`;
};

const KEYS = new Set<string>(SETTING_FIELDS.filter((f) => f.type === "key").map((f) => f.key));

// A key that won't decrypt (ENCRYPTION_KEY changed) counts as not set.
const opened = (k: string, v: unknown) => {
  if (!KEYS.has(k)) return v;
  try {
    return decrypt(v as string);
  } catch {
    return undefined;
  }
};

// With keys in the clear: for the server's own use only, never sent anywhere (forPeople masks them).
export async function settingsFor(workspaceId: string): Promise<Settings> {
  const row = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId), columns: { settings: true } });
  const saved = Object.entries(row?.settings ?? {})
    .map(([k, v]) => [k, opened(k, v)] as const)
    .filter(([k, v]) => v !== undefined && !check(k, v));
  return { ...DEFAULTS, ...Object.fromEntries(saved) };
}

const masked = (k: string, v: unknown) => (KEYS.has(k) && v ? `${KEY_MASK}${String(v).slice(-4)}` : v);
const forPeople = (s: Settings) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, masked(k, v)])) as Settings;

// ponytail: OpenRouter is the only key there is; look the checker up by field when a second one comes
async function keyWorks(key: string) {
  const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  return res?.ok ?? false;
}

const canEdit = (role: string) => role !== "member";

// body: the settings to change; null (or the default) puts one back to the default. What's wrong with them, or null.
// Shared by Settings and the console.
export async function changeSettings(who: { workspaceId: string; userId: string }, body: Record<string, unknown>): Promise<string | null> {
  const errors = Object.entries(body).flatMap(([k, v]) => (v === null ? [] : (check(k, v) ?? [])));
  const picked = SETTING_FIELDS.filter((f) => f.type === "model" && typeof body[f.key] === "string" && body[f.key] !== "auto");
  if (picked.length && !errors.length) {
    const offered = new Set((await listModels()).map((m) => m.id));
    // one from the picker's list, or any other OpenRouter model typed in by name (Custom) that can use tools
    for (const f of picked) {
      const id = body[f.key] as string;
      const problem = offered.has(id) ? null : await customModelProblem(id);
      if (problem) errors.push(`${f.label}: ${problem}`);
    }
  }
  for (const k of KEYS)
    if (typeof body[k] === "string" && body[k] && !errors.length && !(await keyWorks((body[k] as string).trim())))
      errors.push(`${SETTING_FIELDS.find((f) => f.key === k)!.label}: OpenRouter didn't accept that key.`);
  if (errors.length) return errors.join(" ");
  // ponytail: read-then-write, so two admins saving at once can lose one's change; jsonb || in SQL if that bites
  const row = await db.query.workspaces.findFirst({ where: eq(workspaces.id, who.workspaceId), columns: { settings: true } });
  const next: Record<string, unknown> = { ...row?.settings };
  for (const [k, v] of Object.entries(body))
    if (v === null || v === DEFAULTS[k as keyof Settings]) delete next[k];
    else next[k] = KEYS.has(k) ? encrypt((v as string).trim()) : v;
  await db.update(workspaces).set({ settings: next }).where(eq(workspaces.id, who.workspaceId));
  // keys only as "changed", never their value, even encrypted
  const shown = (s: Record<string, unknown>) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, KEYS.has(k) ? "(set)" : v]));
  const changed = Object.keys(body).map((k) => `${SETTING_FIELDS.find((f) => f.key === k)?.label ?? k}: ${KEYS.has(k) ? (body[k] ? "new key" : "removed") : (body[k] ?? "default")}`);
  record({ workspaceId: who.workspaceId, userId: who.userId, kind: "settings", summary: `Changed settings: ${changed.join(", ")}`, detail: { before: shown(row?.settings ?? {}), after: shown(next) } });
  return null;
}

export const settingsForPeople = async (workspaceId: string) => forPeople(await settingsFor(workspaceId));

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/settings", async (req, reply) => {
    const ctx = await context(req, reply);
    if (!ctx) return;
    return { values: forPeople(await settingsFor(ctx.workspaceId)), defaults: DEFAULTS, canEdit: canEdit(ctx.role) } satisfies SettingsResponse;
  });

  // body: the settings to change; null (or the default) puts one back to the default
  app.put<{ Body: Record<string, unknown> }>("/settings", { schema: { body: { type: "object" } } }, async (req, reply) => {
    const ctx = await context(req, reply);
    if (!ctx) return;
    if (!canEdit(ctx.role)) return reply.code(403).send({ error: "Only the owner or an admin can change settings." });
    const problem = await changeSettings(ctx, req.body);
    if (problem) return reply.code(400).send({ error: problem });
    return { values: forPeople(await settingsFor(ctx.workspaceId)), defaults: DEFAULTS, canEdit: true } satisfies SettingsResponse;
  });
}
