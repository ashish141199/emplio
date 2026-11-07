"use client";

import type { Approval } from "@emplio/shared";
import { useMutation } from "@tanstack/react-query";
import { CheckIcon, ChevronRightIcon, PaperclipIcon, XIcon } from "lucide-react";
import { useContext, useState } from "react";
import { ReplyContext } from "@/components/chat/ask-card";
import { AppLogo } from "@/components/chat/connect-card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

const DONE: Record<NonNullable<Approval["decision"]>, string> = {
  once: "Allowed",
  always: "Always allowed",
  deny: "Denied",
  timeout: "Expired, not done",
  skipped: "Skipped, you replied instead",
};

// a file the agent attaches, {"file": "/work/tmp/report.xlsx"} (integrations/index.ts): its name
const fileName = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).join() === "file" && typeof (v as { file: unknown }).file === "string"
    ? (v as { file: string }).file.split("/").pop()!
    : undefined;
const simple = (v: unknown) => typeof v === "string" || typeof v === "number" || typeof v === "boolean";

// "to: priya@acme.com", the simple fields of the input, files as their names and lists of those joined; the rest
// is under Details. Any app, any action.
const fields = (input: unknown) =>
  Object.entries(input && typeof input === "object" ? input : {}).flatMap(([k, v]) => {
    const list = Array.isArray(v) ? v : [v];
    const files = list.map(fileName);
    if (list.length && files.every(Boolean)) return [{ k, v: files.join(", "), file: true }];
    if (list.length && list.every(simple)) return [{ k, v: list.join(", "), file: false }];
    return [];
  });

// An app action the agent wants to run that sends or changes something. It can be answered until it expires
// (2 hours, approvals.ts), then it folds up; an old card without that time counts as expired once its reply ended.
export function ApprovalCard({ approval: card, waiting }: { approval: Approval; waiting: boolean }) {
  const gone = card.expiresAt ? Date.parse(card.expiresAt) < Date.now() : !waiting;
  // a message from them after this reply: they wrote instead of answering (the server skipped it too)
  const repliedAfter = useContext(ReplyContext) !== undefined;
  const approval = card.decision ? card : repliedAfter ? { ...card, decision: "skipped" as const } : gone ? { ...card, decision: "timeout" as const } : card;
  const expired = approval.decision === "timeout" || approval.decision === "skipped";
  const [details, setDetails] = useState(false);
  const answer = useMutation({ mutationFn: (decision: "once" | "always" | "deny") => api<{ result?: string }>(`/approvals/${approval.id}`, { decision }) });
  const shown = fields(approval.input);
  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-3">
        <AppLogo src={approval.logo} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{approval.title}</div>
          <div className="truncate text-xs text-muted-foreground">{approval.appName}{approval.decision ? "" : " · wants your OK"}</div>
        </div>
      </div>
      {!expired && !!shown.length && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {shown.slice(0, 8).map(({ k, v, file }) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k.replaceAll("_", " ")}</dt>
              <dd className="max-h-80 min-w-0 overflow-auto break-words whitespace-pre-wrap">
                {file && <PaperclipIcon className="mr-1 inline size-3 align-[-2px]" />}
                {v}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {!expired && (
        <>
          <button
            type="button"
            onClick={() => setDetails((d) => !d)}
            aria-expanded={details}
            className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronRightIcon className={`size-3 transition-transform ${details ? "rotate-90" : ""}`} /> Details
          </button>
          {details && (
            <pre className="max-h-60 overflow-auto rounded-lg bg-muted p-2 text-xs whitespace-pre-wrap break-words">
              {JSON.stringify(approval.input, null, 2)}
            </pre>
          )}
        </>
      )}
      {answer.data?.result ? (
        // answered after the agent moved on: done by the server, this is how it went
        <div className="text-xs font-medium text-primary">{answer.data.result}</div>
      ) : approval.decision ? (
        <div className={`flex items-center gap-1.5 text-xs font-medium ${approval.decision === "once" || approval.decision === "always" ? "text-primary" : "text-muted-foreground"}`}>
          {approval.decision === "once" || approval.decision === "always" ? <CheckIcon className="size-3.5" /> : <XIcon className="size-3.5" />}
          {DONE[approval.decision]}
        </div>
      ) : answer.isSuccess ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Spinner className="size-3" /> {answer.variables === "deny" ? "Denying…" : "Running…"}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={answer.isPending} onClick={() => answer.mutate("once")}>
            Allow
          </Button>
          {!approval.oneOff && (
            <Button size="sm" variant="outline" disabled={answer.isPending} onClick={() => answer.mutate("always")}>
              Always allow
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={answer.isPending} onClick={() => answer.mutate("deny")}>
            Deny
          </Button>
          {answer.error && <span className="w-full text-xs text-destructive">{answer.error.message}</span>}
        </div>
      )}
    </div>
  );
}
