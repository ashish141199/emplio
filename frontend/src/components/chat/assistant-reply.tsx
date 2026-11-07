"use client";

import dynamic from "next/dynamic";
import { MessageResponse } from "@/components/ai-elements/message";

// Replies are OpenUI Lang programs (they start with `root = ...`). Older chats were Markdown.
const isOpenUI = (text: string) => /^\s*(```[\w-]*\s*)?root\s*=/.test(text);

const OpenUIReply = dynamic(() => import("@/components/chat/openui-reply"), { ssr: false });

// a click in generated UI (openui-reply.tsx); kept here so chats without one don't load OpenUI
export const CLICK_PREFIX = "User clicked: ";

/** What a user bubble shows: clicks read as the button's label, without the form-values payload. */
export const userFacingText = (text: string) =>
  text.startsWith(CLICK_PREFIX) ? text.slice(CLICK_PREFIX.length).split("\nForm values: ")[0] : text;

export function AssistantReply({
  text,
  streaming,
  onSend,
}: {
  text: string;
  streaming: boolean;
  onSend: (text: string) => void;
}) {
  if (!isOpenUI(text)) {
    // until the first few characters arrive we can't tell; don't flash them as Markdown
    if (streaming && text.trim().length < 6) return null;
    return (
      <div data-reply>
        {/* looser lines than the default so long replies read easier */}
        <MessageResponse isAnimating={streaming} className="leading-relaxed [&_li]:my-1">
          {text}
        </MessageResponse>
      </div>
    );
  }

  return (
    <div data-reply className="w-full">
      <OpenUIReply text={text} streaming={streaming} onSend={onSend} />
    </div>
  );
}
