// Talking to Fly.io. Three doors, one token:
//  - the Machines API (api.machines.dev/v1): apps, machines, volumes, certificates, IPs, secrets, Postgres;
//  - the GraphQL API (api.fly.io/graphql): organizations, members, billing, releases, add-ons, health checks;
//  - flyctl's logs endpoint (api.fly.io/api/v1/apps/<app>/logs), the only way to read logs without a NATS client.
import { z } from "zod";
import { AppsError } from "../../types";
import type { OwnAction } from "../index";

export const MACHINES = "https://api.machines.dev/v1";
export const GRAPHQL = "https://api.fly.io/graphql";
export const LOGS = "https://api.fly.io/api/v1/apps";

// `fly tokens create` prints "FlyV1 fm2_…", which goes in the header as is; `fly auth token` gives a bearer token
export const authHeader = (key: string) => (key.startsWith("FlyV1 ") ? key : `Bearer ${key}`);

const parse = (text: string) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export type Query = Record<string, string | number | boolean | undefined>;

// One HTTP call. A 401 means the token is gone (reconnect); any other failure carries Fly's own words.
export async function http(key: string, method: string, url: string, query: Query = {}, body?: unknown, headers: Record<string, string> = {}) {
  const q = new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])));
  const res = await fetch(`${url}${q.size ? `?${q}` : ""}`, {
    method,
    headers: { Authorization: authHeader(key), Accept: "application/json", ...(body !== undefined && { "Content-Type": "application/json" }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = parse(await res.text());
  if (res.status === 401) throw new AppsError("Fly.io rejected the token; make a new one (fly tokens create org) and reconnect", true);
  if (!res.ok) {
    const why = typeof data === "string" ? data : (data?.error ?? data?.message ?? data?.errors?.[0]?.message ?? JSON.stringify(data));
    throw new AppsError(`Fly.io: ${why || res.statusText} (${res.status})`);
  }
  // paged lists say where the next page starts in a header, not the body
  const next = res.headers.get("fly-next-cursor");
  return next ? { items: data, next_cursor: next } : (data ?? { ok: true });
}

export async function graphql(key: string, query: string, variables: Record<string, unknown> = {}) {
  const out = (await http(key, "POST", GRAPHQL, {}, { query, variables })) as { data?: any; errors?: { message: string; extensions?: { code?: string } }[] };
  if (out.errors?.length) {
    if (out.errors.some((e) => e.extensions?.code === "UNAUTHORIZED") && !out.data)
      throw new AppsError("Fly.io rejected the token for this; it may be missing access to that organization, or expired", false);
    throw new AppsError(`Fly.io: ${out.errors.map((e) => e.message).join("; ")}`);
  }
  return out.data;
}

// "{app}" in a path is replaced by the input's field of that name
export const fill = (path: string, input: Record<string, unknown>) =>
  path.replace(/\{(\w+)\}/g, (_, k) => {
    const v = input[k];
    if (v === undefined || v === "") throw new AppsError(`${k} is required`);
    return encodeURIComponent(String(v));
  });

const pick = (input: Record<string, unknown>, keys: readonly string[]) =>
  Object.fromEntries(keys.flatMap((k) => (input[k] === undefined ? [] : [[k, input[k]]])));

// A Machines API action: path params come from the input by name; `query` fields (or what `query` builds) go in
// the URL, `body` fields (or what `body` builds) in the JSON body.
export function rest(
  method: string,
  path: string,
  description: string,
  input: z.ZodRawShape,
  opts: {
    query?: string[] | ((i: any) => Query);
    body?: string[] | ((i: any) => unknown);
    headers?: (i: any) => Record<string, string>;
    readOnly?: boolean;
  } = {},
): OwnAction {
  return {
    description,
    readOnly: opts.readOnly ?? method === "GET",
    input: z.object(input),
    run: (i, key) => {
      const body = typeof opts.body === "function" ? opts.body(i) : opts.body ? pick(i, opts.body) : undefined;
      const query = typeof opts.query === "function" ? opts.query(i) : (pick(i, opts.query ?? []) as Query);
      return http(key, method, `${MACHINES}${fill(path, i)}`, query, body, opts.headers?.(i));
    },
  };
}

// Relay connections ({nodes: [...]}) as plain lists
export const nodes = <T>(c: { nodes?: T[] } | null | undefined) => c?.nodes ?? [];

// GraphQL mutations want the organization's node id; people know its slug
export async function orgId(key: string, slug: string) {
  const data = await graphql(key, "query($slug: String) { organization(slug: $slug) { id } }", { slug });
  if (!data?.organization) throw new AppsError(`no Fly organization '${slug}' on this token (fly.list_organizations shows them)`);
  return data.organization.id as string;
}

// secret keys work on bytes, which the API spells as arrays of numbers; people and scripts use text or base64
export const bytes = (text?: string, base64?: string) =>
  base64 !== undefined ? [...Buffer.from(base64, "base64")] : text !== undefined ? [...Buffer.from(text, "utf8")] : undefined;
export const b64 = (arr?: number[]) => (arr ? Buffer.from(arr).toString("base64") : undefined);
