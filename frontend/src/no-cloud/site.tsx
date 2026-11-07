import type { Metadata } from "next";

// Stands in for Emplio Cloud's public website (cloud/frontend/site.tsx) in a copy without the private cloud/ folder:
// no landing page (the app is the home page) and kept out of search engines.
export const landing: (() => React.ReactNode) | null = null;
export const siteMetadata: Metadata = { robots: { index: false, follow: false } };
export const SiteHead = () => null;
export const ogImage = "/og.png";
