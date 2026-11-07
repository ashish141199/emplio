import type { MetadataRoute } from "next";

// Lets a phone install Emplio to its home screen, where it opens full screen without the browser's bars.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Emplio",
    short_name: "Emplio",
    description: "An AI employee who never clocks out.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: "#fbfaf8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
