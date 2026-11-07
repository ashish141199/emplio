// Integrations we write ourselves, as a provider like Composio. Each app is connected with a key the person
// pastes (kept encrypted in our database) and its actions are plain functions. Add one: write it next to
// indiamart.ts, list it in APPS, and add it to catalog.ts with provider "own".
import type { ActionDetail, KeyField } from "@emplio/shared";
import { z } from "zod";
import { AppsError, type Provider } from "../types";
import { anthropic, google, openai, openrouter } from "./ai";
import { exa } from "./exa";
import { fireflies } from "./fireflies";
import { fly } from "./fly";
import { hostinger } from "./hostinger";
import { indiamart } from "./indiamart";
import { livekit } from "./livekit";
import { msg91 } from "./msg91";
import { neon } from "./neon";
import { plivo } from "./plivo";
import { razorpay } from "./razorpay";
import { sarvam } from "./sarvam";
import { swipe } from "./swipe";
import { vercel } from "./vercel";

export type OwnAction = {
  description: string;
  input: z.ZodObject;
  // input already checked against `input`; key is the decrypted login
  run(input: any, key: string): Promise<unknown>;
  // only looks things up: runs without asking the person first
  readOnly?: boolean;
};
export type OwnApp = {
  app: string;
  name: string;
  logo: string;
  keyField: KeyField;
  // throws an AppsError if the key doesn't work
  check(key: string): Promise<void>;
  actions: Record<string, OwnAction>;
  // events the app tells us about the moment they happen
  push?: {
    // our trigger name → its event
    events: Record<string, string>;
    // the ones with no polled twin in polls/
    triggers: Record<string, { description: string; output: ActionDetail["input"] }>;
    // sets it up, and answers the id events arrive under
    start(key: string, connection: string, event: string): Promise<string>;
  };
};

const APPS: Record<string, OwnApp> = { indiamart, exa, fly, vercel, hostinger, fireflies, anthropic, openai, google, openrouter, sarvam, livekit, msg91, plivo, swipe, neon, razorpay };

const split = (action: string) => {
  const [app = "", name = ""] = action.split(".");
  return { def: APPS[app], action: APPS[app]?.actions[name] };
};

export const own: Provider = {
  name: "own",

  readyApps: async () => new Set(Object.keys(APPS)),

  async getApp(app) {
    const a = APPS[app];
    return a ? { app, name: a.name, description: "", logo: a.logo, keyField: a.keyField } : null;
  },

  async listActions(app, words) {
    const terms = (words ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    return Object.entries(APPS[app]?.actions ?? {})
      .map(([name, a]) => ({ action: `${app}.${name}`, description: a.description }))
      .filter((a) => terms.every((t) => `${a.action} ${a.description}`.toLowerCase().includes(t)));
  },

  async getAction(name) {
    const { action } = split(name);
    if (!action) return null;
    const schema = z.toJSONSchema(action.input, { io: "input" }) as { properties?: Record<string, any>; required?: string[] };
    return {
      action: name,
      app: name.split(".")[0]!,
      description: action.description,
      readOnly: action.readOnly,
      input: Object.entries(schema.properties ?? {}).map(([field, p]) => ({
        name: field,
        type: p.enum ? p.enum.join("|") : (p.type ?? "any"),
        required: schema.required?.includes(field) ?? false,
        description: p.description ?? "",
      })),
    };
  },

  async startSignIn(app) {
    throw new AppsError(`${app} is connected with a key, in the app`);
  },

  async connectWithKey(app, key) {
    const a = APPS[app];
    if (!a) throw new AppsError(`no app called ${app}`);
    const trimmed = key.trim();
    if (!trimmed) throw new AppsError(`enter your ${a.keyField.label}`);
    await a.check(trimmed);
    return { secret: trimmed };
  },

  // the key is in our database, so a connection is good until a call says otherwise
  signInStatus: async () => "active",
  removeSignIn: async () => {},

  async run(name, input, login) {
    const { action } = split(name);
    if (!action) throw new AppsError(`no action ${name}`);
    if (!login?.secret) throw new AppsError("not connected");
    const parsed = action.input.safeParse(input ?? {});
    if (!parsed.success) throw new AppsError(parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
    return action.run(parsed.data, login.secret);
  },

  async listTriggers(app, words) {
    const terms = (words ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    return Object.entries(APPS[app]?.push?.triggers ?? {})
      .map(([name, t]) => ({ action: `${app}.${name}`, description: t.description }))
      .filter((t) => terms.every((w) => `${t.action} ${t.description}`.toLowerCase().includes(w)));
  },

  async getTrigger(trigger) {
    const [app = "", name = ""] = trigger.split(".");
    const t = APPS[app]?.push?.triggers[name];
    return t ? { action: trigger, app, description: t.description, input: [], output: t.output } : null;
  },

  async startPush(trigger, login) {
    const [app = "", name = ""] = trigger.split(".");
    const push = APPS[app]?.push;
    const event = push?.events[name];
    return push && event && login.secret ? push.start(login.secret, login.externalId, event) : null;
  },
};
