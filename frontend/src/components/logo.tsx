"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// Emplio wordmark: Fredoka 500; the first e's top hole is filled and a curved slit cut through it
// (a happy closed eye). Coordinates are for font-size 100 on baseline 92.
// in the app, a click goes to Home and a double click to the landing page
export function Logo({ href = "/", onClick }: { href?: string; onClick?: () => void }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-label="Emplio"
      className="flex items-center text-foreground"
      // already home: a link to the same page doesn't move, so go back to the top
      onDoubleClick={href === "/" ? undefined : () => router.push("/")}
      onClick={(e) => {
        onClick?.();
        if (location.pathname !== href) return;
        e.preventDefault();
        history.replaceState(null, "", href);
        scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      <svg viewBox="2 4 308 116" className="h-8 w-auto" role="img" aria-hidden="true" style={{ fontFamily: "var(--font-logo)" }}>
        <mask id="emplio-eye" maskUnits="userSpaceOnUse" x="-4" y="-15" width="74" height="141">
          <rect x="-4" y="-15" width="74" height="141" fill="#fff" />
          <path d="M25.66 61.08 A9.96 7.47 0 0 1 45.58 61.08" fill="none" stroke="#000" strokeWidth="6.57" strokeLinecap="round" />
        </mask>
        <clipPath id="emplio-bowl">
          <ellipse cx="32.93" cy="67.65" rx="23.69" ry="22.89" />
        </clipPath>
        <g mask="url(#emplio-eye)" className="fill-primary">
          <text x="6" y="92" fontWeight="500" fontSize="100">e</text>
          <rect clipPath="url(#emplio-bowl)" x="6" y="45.74" width="53.85" height="20.45" />
        </g>
        <text x="6" y="92" fontWeight="500" fontSize="100" fill="currentColor">
          <tspan fill="transparent">e</tspan>mplio
        </text>
      </svg>
    </Link>
  );
}
