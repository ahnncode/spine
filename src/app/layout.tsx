import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/Auth";
import { SheetFocus } from "@/components/SheetFocus";
import { SignupSource } from "@/components/SignupSource";
import { SheetScrollLock } from "@/components/SheetScrollLock";
import { SheetSwipe } from "@/components/SheetSwipe";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

const description =
  "readread is a social book tracker and Goodreads alternative. Rank the books you read with quick head-to-heads instead of stars, import from Goodreads or StoryGraph, and see what your friends can't put down.";

export const metadata: Metadata = {
  metadataBase: new URL("https://readread.app"),
  title: "readread: rank books, not stars",
  description,
  applicationName: "readread",
  keywords: ["book tracker", "Goodreads alternative", "StoryGraph alternative", "rank books", "reading tracker", "book ranking app", "book club app", "reading log"],
  appleWebApp: { title: "readread", capable: true, statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "readread", title: "readread: rank books, not stars", description },
  twitter: { card: "summary_large_image", title: "readread: rank books, not stars", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
  width: "device-width",
  initialScale: 1,
  // Draw under the notch and home bar; the CSS pads with the safe-area insets.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        {/* Self-hosted fonts (see globals.css). Preload the two every page shows first. */}
        <link rel="preload" href="/fonts/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/gloock-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <SheetScrollLock />
        <SheetSwipe />
        <SheetFocus />
        <Toaster />
        <SignupSource />
      </body>
    </html>
  );
}
