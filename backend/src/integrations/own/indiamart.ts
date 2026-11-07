// IndiaMART: the buyer enquiries (leads) a seller's listing gets.
//
// The whole public API is one read-only endpoint (the paid "IM Leads API" add-on), so the actions are
// three ways of asking it. What the code below absorbs:
//  - every error is an HTTP 200 with the real code in the body;
//  - times are IST in `DD-MM-YYYYHH:MM:SS`;
//  - one call per five minutes per key, and five quick calls lock the key for fifteen, so calls are
//    spaced here and doomed windows are refused before they cost a call;
//  - the key expires after seven days without a call.
import { z } from "zod";
import { AppsError } from "../types";
import type { OwnApp } from "./index";

const URL_ = "https://mapi.indiamart.com/wservce/crm/crmListing/v2/";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_DAYS = 7;
const MAX_HISTORY_DAYS = 365;
const SPACING_MS = 5 * 60_000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const QUERY_TYPES = {
  W: "Direct enquiry about a product on your catalogue",
  B: "Buy-lead: a buyer's posted requirement IndiaMART matched to you",
  P: "Phone call to your IndiaMART number (has CALL_DURATION)",
  BIZ: "Catalogue view where the buyer left their details",
  WA: "WhatsApp enquiry through IndiaMART",
} as const;
const TYPE_LIST = Object.entries(QUERY_TYPES)
  .map(([code, meaning]) => `${code} = ${meaning}`)
  .join("; ");

const pad = (n: number) => String(n).padStart(2, "0");

// An instant as IndiaMART's DD-MM-YYYYHH:MM:SS in IST.
function istWire(at: number) {
  const d = new Date(at + IST_OFFSET_MS);
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

const istInstant = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s) - IST_OFFSET_MS;

// A time the caller gave, as the instant it means. A bare date or date-time is IST wall clock
// (the provider and its dashboard are Indian); IndiaMART's own two formats are accepted too.
export function istTime(value: string, field: string): number {
  const raw = value.trim();
  const stamp = /^(\d{2})-(\d{2})-(\d{4})(\d{2}):(\d{2}):(\d{2})$/.exec(raw);
  if (stamp) return istInstant(+stamp[3]!, +stamp[2]!, +stamp[1]!, +stamp[4]!, +stamp[5]!, +stamp[6]!);
  const named = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(raw);
  if (named) {
    const month = MONTHS.indexOf(named[2]!.toLowerCase());
    if (month < 0) throw new AppsError(`${field}: '${named[2]}' isn't a month`);
    return istInstant(+named[3]!, month + 1, +named[1]!);
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);
  if (iso) return istInstant(+iso[1]!, +iso[2]!, +iso[3]!, +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0));
  const at = Date.parse(raw);
  if (Number.isNaN(at))
    throw new AppsError(`${field}: '${raw}' isn't a time; use YYYY-MM-DD, YYYY-MM-DD HH:MM:SS (IST) or an ISO time with an offset`);
  return at;
}

function checkWindow(start: number, end: number, now = Date.now()) {
  if (end < start) throw new AppsError("start_time is after end_time");
  if (end - start > MAX_WINDOW_DAYS * DAY_MS)
    throw new AppsError(`IndiaMART allows at most ${MAX_WINDOW_DAYS} days per call; walk longer ranges in ${MAX_WINDOW_DAYS}-day steps`);
  if (now - start > MAX_HISTORY_DAYS * DAY_MS) throw new AppsError(`IndiaMART keeps only the last ${MAX_HISTORY_DAYS} days of leads`);
}

// ponytail: in memory, per process; a second server would need this in the database
const lastCall = new Map<string, number>();

async function fetchLeads(key: string, window: { start: number; end: number } | null, queryType?: string | null) {
  const wait = (lastCall.get(key) ?? 0) + SPACING_MS - Date.now();
  if (wait > 0)
    throw new AppsError(
      `IndiaMART allows one call every 5 minutes (quick repeats lock the key for 15); try again in ${Math.ceil(wait / 1000)}s`,
    );
  lastCall.set(key, Date.now());
  const query = new URLSearchParams({
    glusr_crm_key: key,
    ...(window && { start_time: istWire(window.start), end_time: istWire(window.end) }),
  });
  const res = await fetch(`${URL_}?${query}`, { signal: AbortSignal.timeout(60_000) });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body) throw new AppsError(`IndiaMART answered HTTP ${res.status}`);
  const code = Number(body.CODE);
  const message = typeof body.MESSAGE === "string" ? body.MESSAGE : "";
  // 204 "no leads in the given time" is a normal quiet window, not a failure
  if (String(body.STATUS ?? "").toUpperCase() === "FAILURE" && code !== 204)
    throw new AppsError(message || `IndiaMART answered code ${code}`, code === 401 || code === 403 || code === 404);
  const rows = Array.isArray(body.RESPONSE) ? (body.RESPONSE as Record<string, unknown>[]) : [];
  const leads = queryType ? rows.filter((r) => String(r.QUERY_TYPE ?? "").toUpperCase() === queryType) : rows;
  return { leads, total: leads.length };
}

const queryType = z
  .enum(["W", "B", "P", "BIZ", "WA"])
  .optional()
  .describe(`Only this kind of lead (filtered after the call, so it saves nothing): ${TYPE_LIST}. Omit for all.`);
const times =
  "YYYY-MM-DD (midnight IST), YYYY-MM-DD HH:MM:SS (IST, not UTC), or an ISO time with an offset like 2026-10-22T14:30:00+05:30";

export const indiamart: OwnApp = {
  app: "indiamart",
  name: "IndiaMART",
  logo: "/logos/indiamart.png",
  keyField: {
    label: "Pull API key",
    help: "In your IndiaMART seller dashboard: Lead Manager → IM Leads API (a paid add-on). The key stops working after 7 days unused, and making a new one ends the old.",
    placeholder: "GLUSR-…",
  },
  // a one-minute window: proves the key without touching the "since last call" cursor get_new_leads uses
  async check(key) {
    const now = Date.now();
    await fetchLeads(key, { start: now - 60_000, end: now });
  },
  actions: {
    get_recent_leads: {
      readOnly: true,
      description:
        "Leads from the last N minutes, ending now. The one to use on a schedule: an overlap is harmless (leads carry a stable UNIQUE_QUERY_ID). One call per 5 minutes.",
      input: z.object({
        minutes: z.number().int().min(1).max(MAX_WINDOW_DAYS * 24 * 60).default(60).describe("How far back to look. Default 60, at most 7 days."),
        query_type: queryType,
      }),
      run: ({ minutes, query_type }, key) => {
        const now = Date.now();
        const start = now - minutes * 60_000;
        checkWindow(start, now, now);
        return fetchLeads(key, { start, end: now }, query_type);
      },
    },
    get_leads: {
      readOnly: true,
      description: `Every lead between two times, the same result each run (for backfills). At most ${MAX_WINDOW_DAYS} days per call, last ${MAX_HISTORY_DAYS} days only. One call per 5 minutes.`,
      input: z.object({
        start_time: z.string().describe(`Start, inclusive: ${times}`),
        end_time: z.string().describe(`End, at most ${MAX_WINDOW_DAYS} days after the start: ${times}`),
        query_type: queryType,
      }),
      run: ({ start_time, end_time, query_type }, key) => {
        const start = istTime(start_time, "start_time");
        const end = istTime(end_time, "end_time");
        checkWindow(start, end);
        return fetchLeads(key, { start, end }, query_type);
      },
    },
    get_new_leads: {
      readOnly: true,
      description:
        "Leads since this key was last used (or the last 24 hours). Careful: any call on the key moves that point, so leads it returns are gone for every other reader. Prefer get_recent_leads.",
      input: z.object({ query_type: queryType }),
      run: ({ query_type }, key) => fetchLeads(key, null, query_type),
    },
  },
};

if (import.meta.main) {
  // 22 Oct 2026, 09:30 IST == 04:00 UTC
  console.assert(istTime("2026-10-22 09:30", "t") === Date.UTC(2026, 9, 22, 4, 0), "bare time is IST");
  console.assert(istTime("22-Oct-2026", "t") === istTime("2026-10-22", "t"), "IndiaMART date form");
  console.assert(istTime("22-10-202609:30:00", "t") === istTime("2026-10-22T09:30:00+05:30", "t"), "IndiaMART stamp form");
  console.assert(istWire(Date.UTC(2026, 9, 22, 4, 0)) === "22-10-202609:30:00", "wire format");
  let refused = false;
  try {
    checkWindow(istTime("2026-10-01", "s"), istTime("2026-10-20", "e"), istTime("2026-10-22", "n"));
  } catch {
    refused = true;
  }
  console.assert(refused, "window over 7 days refused");
  console.log("indiamart ok");
}
