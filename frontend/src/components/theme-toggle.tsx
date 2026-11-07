"use client";

// Light or dark in one click: the sun sets and the moon rises (and back). Saved per device like the setting in
// Settings (lib/theme.ts).
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setThemeChoice, useDark } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useDark();
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className={cn("relative overflow-hidden rounded-full", className)}
      onClick={() => setThemeChoice(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <SunIcon className="absolute size-5 rotate-0 scale-100 transition-transform duration-500 ease-out dark:-rotate-90 dark:translate-y-6 dark:scale-0" />
      <MoonIcon className="absolute size-5 translate-y-6 rotate-90 scale-0 transition-transform duration-500 ease-out dark:translate-y-0 dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
