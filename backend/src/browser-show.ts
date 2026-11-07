// "Show Emplio how": the person does something once in the live browser and Emplio gets it all as a file, what they
// clicked, typed and said and what the page asked its server, in order. The server watches the browser itself over
// DevTools, so Emplio's browser tool needn't be attached. Emplio is told and decides what to do with it; it isn't
// allowed to use the browser meanwhile (sandbox.ts).
// ponytail: top-level pages only (a login or payment form inside another site's frame isn't noted); lost if this
// server restarts mid-recording.
import { readFileSync } from "node:fs";
import { devtools, holdOpen, openBrowser } from "./browser";
import { keep as keepCall, siteOf as hostSite } from "./site-calls";

const RECORDER = readFileSync(new URL("./browser-recorder.js", import.meta.url), "utf8");
const MAX_STEPS = 500;
const SENT_MAX = 2000;
const REPLY_MAX = 1500;
const READ_REPLY_MAX = 300;
// long enough for a real task; billed while open, so one forgotten doesn't run on
const LONGEST_MS = 30 * 60_000;

// same as the call list in sandbox.ts
const SECRET = /("?[\w-]*(?:pass|pwd|secret|token|otp|cvv|api_?key|authorization)[\w-]*"?\s*[:=]\s*)("(?:[^"\\]|\\.)*"|[^&\s,}]+)/gi;
const LOGIN_PATH = /log.?in|sign.?in|auth|otp|password|token/i;

export const masked = (text: string) => text.replace(SECRET, '$1"***"');
const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

const siteOf = (url: string) => {
  try {
    return hostSite(new URL(url).hostname);
  } catch {
    return "";
  }
};

type Found = { marker?: string; place?: string };
type Step = ({ type: "click"; kind: string; name: string } & Found) | ({ type: "fill"; name: string; value: string | null } & Found) | { type: "key"; key: string };

const foundAt = (s: Found) => `${s.marker ? ` [${s.marker}]` : ""}${s.place ? ` in ${s.place}` : ""}`;

export function stepLine(s: Step) {
  if (s.type === "click") return `Clicked ${s.kind}${s.name ? ` "${s.name}"` : ""}${foundAt(s)}`;
  if (s.type === "fill") return `Filled "${s.name}"${foundAt(s)} with ${s.value === null ? "(hidden)" : `"${s.value}"`}`;
  return `Pressed ${s.key}`;
}

// The page's own requests worth reading: to its own site, fetch or XHR, reading data or changing something.
export const worthKeeping = (r: { type?: string; url: string; page: string; method: string; status: number; mime: string }) =>
  (r.type === "XHR" || r.type === "Fetch") && !r.url.includes("/cdn-cgi/") && siteOf(r.url) === siteOf(r.page) && (r.mime.includes("json") || r.method !== "GET") && r.status < 400;

// Changes get all of it, they're the point; a read only needs enough to see what it returns.
export function requestLine(r: { url: string; method: string; status: number; sent?: string; reply?: string }) {
  const u = new URL(r.url);
  // a login's contents never go in the file, even masked
  const login = LOGIN_PATH.test(u.pathname);
  const reading = r.method === "GET";
  return [
    `${reading ? "Page read" : "PAGE SAVED"}: ${r.method} ${u.host}${u.pathname}${u.search ? masked(u.search) : ""} ${r.status}`,
    ...(r.sent && !login ? [`  sent: ${cut(masked(r.sent), SENT_MAX)}`] : []),
    ...(r.reply && !login ? [`  reply: ${cut(masked(r.reply), reading ? READ_REPLY_MAX : REPLY_MAX)}`] : []),
  ].join("\n");
}

// One request as site-calls.ts keeps it: where it goes and its field names, never values (as CALLS_PY in sandbox.ts).
const PLAIN = /^[A-Za-z_][\w.-]{0,40}$/;
const parsed = (text?: string) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // plain text isn't a form: its words would pass for field names
    return text.includes("=") ? Object.fromEntries(new URLSearchParams(text)) : null;
  }
};
const shape = (v: unknown, depth = 0): string => {
  if (Array.isArray(v)) return `${v.length} rows${v[0] && typeof v[0] === "object" && depth < 2 ? ` of ${shape(v[0], depth + 1)}` : ""}`;
  if (!v || typeof v !== "object") return "text";
  const entries = Object.entries(v);
  const parts = entries.slice(0, 8).map(([k, x]) => `${PLAIN.test(k) ? k : "*"}${x && typeof x === "object" && depth < 2 ? ` ${shape(x, depth + 1)}` : ""}`);
  return `{${parts.join(", ")}${entries.length > 8 ? ", ..." : ""}}`;
};
const topKeys = (v: unknown) => {
  const first = Array.isArray(v) ? v[0] : v;
  if (!first || typeof first !== "object") return null;
  const keys = Object.keys(first).filter((k) => PLAIN.test(k)).sort().slice(0, 30);
  return keys.length ? keys : null;
};

export function callRow(r: { url: string; method: string; sent?: string; reply?: string }) {
  const u = new URL(r.url);
  const sent = parsed(r.sent);
  const got = parsed(r.reply);
  return {
    host: u.host,
    method: r.method,
    // ids, emails and long tokens in an address are values
    path: u.pathname.split("/").map((p) => (/^(\d+|[0-9a-fA-F-]{16,}|[^/]*@[^/]*)$/.test(p) || (/\d/.test(p) && /^[\w-]{16,}$/.test(p)) ? "*" : p)).join("/").slice(0, 500),
    op: typeof sent?.operationName === "string" ? sent.operationName.slice(0, 200) : "",
    query: [...u.searchParams.keys()].map((k) => `${k}=`).join("&").slice(0, 300),
    sends: sent ? shape(sent).slice(0, 500) : "",
    returns: got ? shape(got).slice(0, 500) : "",
    keys: topKeys(got),
  };
}

// at: ms into the recording, which puts speech (it arrives late, once transcribed) where it was said
type Timed = { at: number; line: string };
const SAID_MAX = 4000;

export function sayLine(text: string | null) {
  return text === null ? "Said something here that couldn't be made out" : `Said: "${cut(text, SAID_MAX)}"`;
}

// In the order it happened; things at the same moment stay as they came.
export const showFile = (steps: Timed[]) => [...steps].sort((a, b) => a.at - b.at).map((s, i) => `${i + 1}. ${s.line}`).join("\n");

type Recording = { steps: Timed[]; calls: ReturnType<typeof callRow>[]; began: number; close: () => void; release: () => void; timer: Timer };
const showing = new Map<string, Recording>();
// files waiting to go onto the person's computer with the chat's next command
const waiting = new Map<string, { name: string; text: string }[]>();

export const isShowing = (conversationId: string) => showing.has(conversationId);
// how long it's been recording, for the timer and for voice after a reload of the app
export const showingFor = (conversationId: string) => {
  const r = showing.get(conversationId);
  return r ? Date.now() - r.began : null;
};

export function takeShown(conversationId: string) {
  const files = waiting.get(conversationId) ?? [];
  waiting.delete(conversationId);
  return files;
}

// False when the chat has no browser open.
export async function startShowing(conversationId: string) {
  if (showing.has(conversationId)) return true;
  const live = await openBrowser(conversationId);
  if (!live) return false;
  const cdp = await devtools(live.cdpUrl);
  const steps: Timed[] = [];
  const began = Date.now();
  const add = (line: string) => {
    if (steps.length < MAX_STEPS) steps.push({ at: Date.now() - began, line });
  };
  type Pending = { type?: string; url: string; page: string; method: string; sent?: string; status?: number; mime?: string };
  const requests = new Map<string, Pending>();
  const attached = new Set<string>();
  const readsSeen = new Set<string>();
  const calls: ReturnType<typeof callRow>[] = [];

  const watch = async (targetId: string, url: string) => {
    if (attached.has(targetId)) return;
    attached.add(targetId);
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Runtime.addBinding", { name: "__emplioShow" }, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: RECORDER }, sessionId);
    await cdp.send("Runtime.evaluate", { expression: RECORDER }, sessionId);
    if (/^https?:/.test(url)) add(`On page: ${masked(url)}`);
  };

  const finished = async (requestId: string, sessionId: string) => {
    const r = requests.get(requestId);
    requests.delete(requestId);
    if (!r || r.status === undefined) return;
    const full = { ...r, status: r.status, mime: r.mime ?? "" };
    if (!worthKeeping(full)) return;
    // the same read again (every page asks who's signed in) says nothing new
    const u = new URL(full.url);
    if (full.method === "GET" && readsSeen.has(u.host + u.pathname)) return;
    readsSeen.add(u.host + u.pathname);
    const body = await cdp.send("Network.getResponseBody", { requestId }, sessionId).catch(() => null);
    const reply = body && !body.base64Encoded ? (body.body as string) : undefined;
    add(requestLine({ ...full, reply }));
    if (!LOGIN_PATH.test(u.pathname)) calls.push(callRow({ ...full, reply }));
  };

  cdp.on((method, p, sessionId) => {
    if (method === "Target.targetCreated" && p.targetInfo.type === "page") void watch(p.targetInfo.targetId, p.targetInfo.url).catch(() => {});
    else if (method === "Runtime.bindingCalled" && p.name === "__emplioShow") {
      try {
        add(stepLine(JSON.parse(p.payload)));
      } catch {}
    } else if (method === "Page.frameNavigated" && !p.frame.parentId && /^https?:/.test(p.frame.url)) add(`On page: ${masked(p.frame.url)}`);
    else if (method === "Network.requestWillBeSent")
      requests.set(p.requestId, { type: p.type, url: p.request.url, page: p.documentURL, method: p.request.method, sent: p.request.postData });
    else if (method === "Network.responseReceived") {
      const r = requests.get(p.requestId);
      if (r) Object.assign(r, { status: p.response.status, mime: p.response.mimeType });
    } else if ((method === "Network.loadingFinished" || method === "Network.loadingFailed") && sessionId) void finished(p.requestId, sessionId).catch(() => {});
  });
  // lists the pages already open, then each new one (a link that opens a tab)
  await cdp.send("Target.setDiscoverTargets", { discover: true });

  showing.set(conversationId, {
    steps,
    calls,
    began,
    close: cdp.close,
    release: holdOpen(conversationId, live),
    timer: setTimeout(() => void stopShowing(conversationId, false), LONGEST_MS),
  });
  return true;
}

// What they said, transcribed in their browser. False when nothing's recording any more.
export function sayShowing(conversationId: string, at: number, text: string | null) {
  const r = showing.get(conversationId);
  if (!r || r.steps.length >= MAX_STEPS) return false;
  r.steps.push({ at, line: sayLine(text) });
  return true;
}

// Ends it. With keep, and something done: the file's path on the person's computer, on its way there.
export function stopShowing(conversationId: string, keep: boolean, workspaceId?: string) {
  const r = showing.get(conversationId);
  if (!r) return null;
  showing.delete(conversationId);
  clearTimeout(r.timer);
  r.close();
  r.release();
  if (!keep || !r.steps.some((s) => !s.line.startsWith("On page:"))) return null;
  // the site's requests are remembered whatever Emplio does with the file
  if (workspaceId)
    void Promise.all(r.calls.map((c) => keepCall(workspaceId, c))).catch((error) => console.error("saving shown requests failed", error));
  const name = `shown-${Date.now()}.md`;
  const text = `${showFile(r.steps)}\n${r.steps.length >= MAX_STEPS ? "(the recording stopped here: too many steps)\n" : ""}`;
  waiting.set(conversationId, [...(waiting.get(conversationId) ?? []), { name, text }]);
  return `/work/tmp/${name}`;
}

// While the person has the mouse, Emplio's pretend pointer (browser-pointer.js) stays away: it follows whatever the
// page feels, which would be them. Held over DevTools so it covers every page and tab; the flag goes with the session.
// ponytail: an app closed mid-control leaves the pointer hidden until the longest recording's limit
const HIDE = `window.__ezPointerOff = true; document.getElementById("__ez_cursor")?.remove();`;
const hiding = new Map<string, Promise<() => Promise<void>>>();

async function holdPointer(conversationId: string) {
  const live = await openBrowser(conversationId);
  if (!live) throw new Error("no browser open");
  const cdp = await devtools(live.cdpUrl);
  const sessions: string[] = [];
  cdp.on((method, p) => {
    if (method !== "Target.targetCreated" || p.targetInfo.type !== "page") return;
    void (async () => {
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId: p.targetInfo.targetId, flatten: true });
      sessions.push(sessionId);
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: HIDE }, sessionId);
      await cdp.send("Runtime.evaluate", { expression: HIDE }, sessionId);
    })().catch(() => {});
  });
  await cdp.send("Target.setDiscoverTargets", { discover: true });
  const timer = setTimeout(() => void hidePointer(conversationId, false), LONGEST_MS);
  return async () => {
    clearTimeout(timer);
    await Promise.all(sessions.map((s) => cdp.send("Runtime.evaluate", { expression: "window.__ezPointerOff = false" }, s).catch(() => {})));
    cdp.close();
  };
}

export async function hidePointer(conversationId: string, hide: boolean) {
  const held = hiding.get(conversationId);
  if (hide) {
    if (held) return;
    const holding = holdPointer(conversationId);
    hiding.set(conversationId, holding);
    await holding.catch(() => hiding.delete(conversationId));
  } else if (held) {
    hiding.delete(conversationId);
    await (await held.catch(() => null))?.();
  }
}
