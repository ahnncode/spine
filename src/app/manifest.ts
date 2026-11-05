import type { MetadataRoute } from "next";

/** Lets people add readread to their home screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "readread: rank books, not stars",
    short_name: "readread",
    description: "Rank what you read with quick head-to-heads, and see what your friends can't put down.",
    start_url: "/feed",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#f7f7f5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
