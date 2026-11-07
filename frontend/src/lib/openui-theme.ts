import { createTheme, defaultLightTheme, type Theme } from "@openuidev/react-ui";

// OpenUI's typography tokens bake in "Inter"; swap in the app's fonts everywhere they appear.
const fonts = Object.fromEntries(
  Object.entries(defaultLightTheme)
    .filter(([, v]) => typeof v === "string" && v.includes('"Inter", sans-serif'))
    .map(([k, v]) => [
      k,
      (v as string).replace(
        '"Inter", sans-serif',
        /heading/i.test(k) ? "var(--font-bricolage), sans-serif" : "var(--font-dm-sans), sans-serif",
      ),
    ]),
) as Partial<Theme>;

const chart = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--chart-${n})`);

// Generated UI uses the app's own color tokens (globals.css), so it matches the rest of the app.
export const openuiTheme = createTheme({
  ...fonts,
  fontCode: "var(--font-jetbrains), monospace",
  background: "var(--background)",
  foreground: "var(--card)",
  popoverBackground: "var(--popover)",
  textNeutralPrimary: "var(--foreground)",
  textNeutralSecondary: "var(--muted-foreground)",
  textNeutralLink: "var(--primary)",
  textBrand: "var(--primary)",
  textAccentPrimary: "var(--primary-foreground)",
  interactiveAccentDefault: "var(--primary)",
  interactiveAccentHover: "color-mix(in oklch, var(--primary), black 10%)",
  interactiveAccentPressed: "color-mix(in oklch, var(--primary), black 18%)",
  interactiveAccentDisabled: "color-mix(in oklch, var(--primary), white 50%)",
  borderDefault: "var(--border)",
  borderAccent: "var(--primary)",
  chatUserResponseBg: "var(--secondary)",
  chatUserResponseText: "var(--foreground)",
  radiusM: "10px",
  defaultChartPalette: chart,
});
