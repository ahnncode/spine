import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/Auth";
import "./globals.css";

const description =
  "ReadRead is a social book tracker and Goodreads alternative. Rank the books you read with quick head-to-heads instead of stars, import from Goodreads or StoryGraph, and see what your friends can't put down.";

export const metadata: Metadata = {
  metadataBase: new URL("https://readread.app"),
  title: "ReadRead — rank books, not stars",
  description,
  applicationName: "ReadRead",
  keywords: ["book tracker", "Goodreads alternative", "StoryGraph alternative", "rank books", "reading tracker", "book ranking app", "book club app", "reading log"],
  alternates: { canonical: "/" },
  appleWebApp: { title: "ReadRead", capable: true, statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "ReadRead", url: "/", title: "ReadRead — rank books, not stars", description },
  twitter: { card: "summary_large_image", title: "ReadRead — rank books, not stars", description },
};

export const viewport: Viewport = {
  themeColor: "#f7f7f5",
  width: "device-width",
  initialScale: 1,
  // Draw under the notch and home bar; the CSS pads with the safe-area insets.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Loaded at runtime rather than via next/font so builds don't need Google Fonts access. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Geist:wght@400..700&family=Geist+Mono:wght@500;700&family=Newsreader:ital,opsz,wght@1,6..72,400..500&display=swap"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
