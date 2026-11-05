import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseUrl.replace(/^https:/, "wss:");

// Only the services the app actually talks to: Supabase (accounts and data),
// Open Library (search and covers, which redirect to archive.org), Apple Books
// (backup cover art), Google Fonts
// and Cloudflare Turnstile.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // Open Library covers often redirect to archive.org itself (not a subdomain) first.
  "img-src 'self' data: blob: https://covers.openlibrary.org https://archive.org https://*.archive.org https://*.mzstatic.com",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs} https://openlibrary.org https://itunes.apple.com https://challenges.cloudflare.com`,
  // Cloudflare Turnstile (bot check on sign-in) runs in a frame.
  "frame-src https://challenges.cloudflare.com",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The barcode scanner needs the camera; nothing needs the mic or location.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
