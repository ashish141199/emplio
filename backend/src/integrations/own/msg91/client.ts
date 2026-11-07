// Talking to MSG91. One Auth Key, sent as the `authkey` header, opens every product. Most calls live on
// control.msg91.com/api/v5; WhatsApp groups, template creation and the OTP widget are documented on
// api.msg91.com/api/v5 (same backend, same key). Two pre-v5 calls (balance, sub-accounts) want the key in the query.
import { z } from "zod";
import type { Api } from "../openapi";
import { call } from "../openapi";
import type { OwnAction } from "../index";

const errorText = (e: unknown) => (typeof e === "string" ? e : Array.isArray(e) ? e.join("; ") : e ? JSON.stringify(e) : "failed");

// MSG91 answers many failures with a 200: {"type":"error"} (SMS, OTP), {"hasError":true,"errors":…} (WhatsApp, RCS,
// templates), {"success":false} (Hello), {"error":"…"} (reports), {"msgType":"error"} (the old PHP endpoints)
export const failed = (b: any): string | undefined => {
  if (!b || typeof b !== "object" || Array.isArray(b)) return undefined;
  if (b.type === "error") return b.message ?? "failed";
  if (b.hasError === true || b.status === "fail" || b.status === "error") return errorText(b.errors ?? b.message);
  if (b.success === false) return b.message ?? "failed";
  if (b.msgType === "error" || b.msg_type === "error") return errorText(b.msg ?? b.msg_arr);
  if (typeof b.error === "string") return b.error;
  return undefined;
};

const common = {
  name: "MSG91",
  tokenHelp: "MSG91 panel → your name (top right) → Authkey",
  auth: (key: string) => ({ authkey: key }),
  failed,
};
export const CONTROL: Api = { ...common, base: "https://control.msg91.com/api/v5" };
export const API: Api = { ...common, base: "https://api.msg91.com/api/v5" };
// the pre-v5 PHP endpoints take the key as ?authkey=, which `legacy` puts in the query
const LEGACY: Api = { ...common, base: "https://control.msg91.com/api", auth: () => ({}) };

// A call whose body `rest` can't shape: a JSON body on a DELETE, a multipart form, or a body built from friendlier
// input (`body`). {names} in the path come from the input; `query` fields go in the URL; the rest is the body.
export function send(
  api: Api,
  method: string,
  path: string,
  description: string,
  input: z.ZodObject,
  opts: { readOnly?: boolean; query?: string[]; body?: (i: any) => unknown; form?: boolean } = {},
): OwnAction {
  const inPath = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
  return {
    description,
    input,
    readOnly: opts.readOnly ?? false,
    run: (i: Record<string, unknown>, key: string) => {
      const query = (opts.query ?? []).filter((k) => i[k] !== undefined);
      if (opts.body) return call(api, key, { method, path, query, headers: [], body: { kind: "whole", field: "__body" } }, { ...i, __body: opts.body(i) });
      const fields = Object.keys(i)
        .filter((k) => i[k] !== undefined && !inPath.includes(k) && !query.includes(k))
        .map((k): [string, string] => [k, k]);
      return call(api, key, { method, path, query, headers: [], body: fields.length ? { kind: opts.form ? "form" : "fields", fields } : undefined }, i);
    },
  };
}

// a GET on the old PHP API: every input field and the key go in the query
export const legacy = (path: string, description: string, input: z.ZodObject, opts: { readOnly?: boolean; rename?: Record<string, string> } = {}): OwnAction => ({
  description,
  input,
  readOnly: opts.readOnly ?? true,
  run: (i: Record<string, unknown>, key: string) => {
    const q = Object.fromEntries(Object.entries({ ...i, authkey: key }).map(([k, v]) => [opts.rename?.[k] ?? k, v]));
    return call(LEGACY, key, { method: "GET", path, query: Object.keys(q), headers: [] }, q);
  },
});

// ── shared fields
export const mobile = z
  .string()
  .regex(/^\d{8,15}$/, "digits only, with the country code and no +")
  .describe("Mobile number with country code, digits only, no + or spaces, e.g. 919876543210 for an Indian number");
export const mobiles = z.array(mobile).min(1).describe("Mobile numbers with country code, digits only, e.g. [\"919876543210\"]");
export const integratedNumber = z
  .string()
  .min(1)
  .describe("Your WhatsApp business number on MSG91 (the sender), with country code and no +, e.g. 918012345678; msg91.list_whatsapp_numbers shows them");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
// logs: MSG91 only keeps a 3-day window online; analytics: up to 31 days
export const logRange = {
  startDate: date.describe("First day, YYYY-MM-DD; must be within the last 3 days"),
  endDate: date.describe("Last day, YYYY-MM-DD; at most 3 days after startDate"),
};
export const analyticsRange = {
  startDate: date.describe("First day, YYYY-MM-DD (data from 1 Jan 2024 on)"),
  endDate: date.describe("Last day, YYYY-MM-DD; the range can be at most 31 days"),
};
