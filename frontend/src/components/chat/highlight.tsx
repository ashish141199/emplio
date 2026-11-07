"use client";

import Link from "next/link";
import { type KeyboardEvent, type ReactNode, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Text with some exact pieces marked: "/menu-cards" (a / command) and "@Priya Nair" (a mention).
// Only colour and background change, never size or weight, so the same text lines up exactly when it's
// drawn under the message box (HighlightLayer). A mark with an entry in `links` opens that page.
export function Marked({ text, marks, links, className }: { text: string; marks: string[]; links?: Record<string, string>; className?: string }): ReactNode {
  const pieces = [...new Set(marks.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!pieces.length) return text;
  const pattern = new RegExp(`(${pieces.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text.split(pattern).map((piece, i) =>
    pieces.includes(piece) ? (
      <mark key={i} className={cn("rounded-sm bg-primary/15 text-primary", className)}>
        {links?.[piece] ? (
          <Link href={links[piece]} className="hover:underline">
            {piece}
          </Link>
        ) : (
          piece
        )}
      </mark>
    ) : (
      piece
    ),
  );
}

// Backspace right after a coloured /command or @mention takes the whole of it, not one letter.
export function eraseMark(e: KeyboardEvent<HTMLTextAreaElement>, text: string, marks: string[], setText: (t: string) => void) {
  const box = e.currentTarget;
  const at = box.selectionStart;
  if (e.key !== "Backspace" || e.defaultPrevented || at !== box.selectionEnd) return;
  const mark = marks
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .find((m) => text.slice(at - m.length, at) === m);
  if (!mark) return;
  e.preventDefault();
  const start = at - mark.length;
  setText(text.slice(0, start) + text.slice(at));
  requestAnimationFrame(() => box.setSelectionRange(start, start));
}

// The message box's text drawn again underneath it with the marks coloured in, while the box's own text is
// transparent (the caret and selection stay the box's). Font, spacing and scroll are copied from the box
// itself, so it lines up whatever classes the box ends up with.
const COPIED = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "textIndent",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
] as const;

export function HighlightLayer({ text, marks }: { text: string; marks: string[] }) {
  const layer = useRef<HTMLDivElement>(null);
  const active = marks.some((m) => m && text.includes(m));
  useLayoutEffect(() => {
    const div = layer.current;
    const box = div?.parentElement?.querySelector("textarea");
    if (!div || !box) return;
    const sync = () => {
      const style = getComputedStyle(box);
      for (const k of COPIED) div.style[k] = style[k];
      div.style.borderStyle = "solid";
      div.style.borderColor = "transparent";
      div.scrollTop = box.scrollTop;
    };
    sync();
    // the box hides its own text only while there's something to colour, so plain typing is untouched
    box.classList.toggle("text-transparent", active);
    box.classList.toggle("caret-foreground", active);
    box.addEventListener("scroll", sync);
    const resized = new ResizeObserver(sync);
    resized.observe(box);
    return () => {
      box.removeEventListener("scroll", sync);
      resized.disconnect();
      box.classList.remove("text-transparent", "caret-foreground");
    };
  }, [active, text]);
  if (!active) return null;
  return (
    <div
      ref={layer}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden break-words whitespace-pre-wrap text-foreground"
    >
      <Marked text={text} marks={marks} />
      {/* a last empty line still takes space, like in the box */}
      {"​"}
    </div>
  );
}
