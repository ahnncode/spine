import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/Auth";
import "./globals.css";

const description = "Rank what you read with quick head-to-heads, and see what your friends can't put down.";

export const metadata: Metadata = {
  metadataBase: new URL("https://readspine.app"),
  title: "Spine — rank books, not stars",
  description,
  applicationName: "Spine",
  appleWebApp: { title: "Spine", capable: true, statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "Spine", url: "/", title: "Spine — rank books, not stars", description },
  twitter: { card: "summary_large_image", title: "Spine — rank books, not stars", description },
};

export const viewport: Viewport = {
  themeColor: "#f7f7f5",
  width: "device-width",
  initialScale: 1,
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
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Geist:wght@400..700&family=Geist+Mono:wght@500;700&display=swap"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
