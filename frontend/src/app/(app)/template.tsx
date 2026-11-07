"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

// The order of the sections, in the bottom tabs and the side menu: the new page drifts in from the side it lies on.
const TABS = [["/chat", "/home"], ["/tasks"], ["/knowledge", "/files", "/database"], ["/team"]];
const tabOf = (path: string) => TABS.findIndex((paths) => paths.some((p) => path.startsWith(p)));

let previous: string | null = null;

// A template, not a layout: its animation plays on each page change (globals.css .page-in).
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const page = useRef<HTMLDivElement>(null);
  // An effect, not worked out while drawing: Next keeps visited pages alive and shows them again, and this runs
  // each time one comes back. Pages outside the tabs just fade.
  useLayoutEffect(() => {
    if (previous === pathname) return;
    const from = previous === null ? -1 : tabOf(previous);
    const to = tabOf(pathname);
    page.current?.style.setProperty("--page-direction", String(from < 0 || to < 0 ? 0 : Math.sign(to - from)));
    previous = pathname;
  }, [pathname]);
  return (
    <div ref={page} className="page-in flex min-h-0 w-full flex-1 flex-col">
      {children}
    </div>
  );
}
