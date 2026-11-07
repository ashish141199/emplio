"use client";

import { useSyncExternalStore } from "react";

// Light, dark, or whatever the device uses; kept per device. The page's first script (layout.tsx)
// applies it before anything paints and follows the device when it switches.
export type ThemeChoice = "light" | "dark" | "system";
const KEY = "theme";

export const THEME_SCRIPT = `(function(){var m=matchMedia("(prefers-color-scheme: dark)");function a(){var t;try{t=localStorage.getItem("${KEY}")}catch(e){}document.documentElement.classList.toggle("dark",t==="dark"||(t!=="light"&&m.matches))}a();m.addEventListener("change",a);window.__applyTheme=a})()`;

export function themeChoice(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {}
  (window as { __applyTheme?: () => void }).__applyTheme?.();
}

// whether the page is dark right now, for parts that need it in code (the AI's generated replies)
const subscribe = (onChange: () => void) => {
  const o = new MutationObserver(onChange);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => o.disconnect();
};
export const useDark = () =>
  useSyncExternalStore(subscribe, () => document.documentElement.classList.contains("dark"), () => false);
