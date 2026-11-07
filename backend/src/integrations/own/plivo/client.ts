// Talking to Plivo. One key, "AUTH_ID:AUTH_TOKEN", sent as HTTP Basic auth. Most calls live under
// api.plivo.com/v1/Account/{auth_id}/; Lookup, call feedback and PHLO each have a host of their own.
import { z } from "zod";
import type { OwnAction } from "../index";
import { type Api, call, rest } from "../openapi";

export const authId = (key: string) => key.slice(0, key.indexOf(":"));

const basic = (key: string) => ({ Authorization: `Basic ${Buffer.from(key).toString("base64")}` });
const shared = { name: "Plivo", tokenHelp: "console.plivo.com → Overview: Auth ID and Auth Token, pasted as AUTH_ID:AUTH_TOKEN", auth: basic };

export const api: Api = { ...shared, base: "https://api.plivo.com", url: (key, base, path) => `${base}/v1/Account/${authId(key)}${path}` };
// paths for these are written whole (/v1/Number/…), no account in them
export const lookupApi: Api = { ...shared, base: "https://lookup.plivo.com" };
export const statsApi: Api = { ...shared, base: "https://stats.plivo.com" };
export const phloApi: Api = { ...shared, base: "https://phlorunner.plivo.com/v1" };
// running a PHLO is the one PHLO call with the account in its path
export const phloRunApi: Api = { ...shared, base: "https://phlorunner.plivo.com/v1", url: (key, base, path) => `${base}/account/${authId(key)}${path}` };

type Opts = { readOnly?: boolean; query?: string[]; loose?: boolean; api?: Api };

// A Plivo call: {names} in the path come from the input; the rest is the query (GET/DELETE) or the JSON body.
// `loose` lets rarer fields Plivo takes through untouched.
export const r = (method: string, path: string, description: string, shape: z.ZodRawShape = {}, opts: Opts = {}): OwnAction =>
  rest(opts.api ?? api, method, path, description, opts.loose ? z.object(shape).loose() : z.object(shape), opts);

// A multipart upload (media, documents): files ({"file": "/work/..."}) go as files, objects as JSON, the rest as text.
// `files` renames inputs to the field names Plivo wants (documents[0].file…); undefined drops one.
export const upload = (
  method: string,
  path: string,
  description: string,
  shape: z.ZodRawShape,
  files: (i: Record<string, any>) => Record<string, any> = () => ({}),
): OwnAction => {
  const inPath = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
  return {
    description,
    input: z.object(shape),
    run: (i: Record<string, any>, key: string) => {
      const all = { ...i, ...files(i) };
      const fields = Object.keys(all).filter((k) => !inPath.includes(k) && all[k] !== undefined);
      return call(api, key, { method, path, query: [], headers: [], body: { kind: "form", fields: fields.map((k): [string, string] => [k, k]) } }, all);
    },
  };
};

// ── shared fields
export const limit = (max = 20) => z.number().int().min(1).max(max).optional().describe(`How many per page (1-${max}, default 20)`);
export const offset = z.number().int().min(0).optional().describe("How many to skip, for the next page (default 0); meta.next in the answer says if there are more");
export const page = (max = 20) => ({ limit: limit(max), offset });
export const e164 = (what: string) => z.string().min(1).describe(`${what}: a phone number in E.164 with country code, e.g. +919876543210`);
// numbers inside a URL path: Plivo writes them without the +
export const pathNumber = (what = "The phone number") => z.string().min(1).describe(`${what} with country code, digits only, e.g. 14155551234 or 919876543210`);
export const method = (what: string) => z.enum(["GET", "POST"]).optional().describe(`How Plivo calls ${what} (default POST)`);
export const url = (what: string) => z.string().optional().describe(what);
export const subaccount = z.string().optional().describe("A subaccount's auth_id (plivo.list_subaccounts), to act for or filter by that subaccount");
// date filters: the field plus its __gt/__gte/__lt/__lte variants
export const range = (field: string, what: string, format = "YYYY-MM-DD HH:MM[:SS], UTC") =>
  Object.fromEntries(
    [
      ["", "exactly"],
      ["__gt", "after"],
      ["__gte", "on or after"],
      ["__lt", "before"],
      ["__lte", "on or before"],
    ].map(([s, w]) => [`${field}${s}`, z.string().optional().describe(`${what} ${w} this (${format})`)]),
  );
// every field of a create, optional, for its update
export const optional = (shape: z.ZodRawShape) => Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, (v as z.ZodType).optional()]));
export const file = z.any().describe('A file from the computer: {"file": "/work/..."}');
