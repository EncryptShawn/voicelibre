// app/layout.tsx (RootLayout)

import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { SessionProvider } from "next-auth/react";
import { SessionSyncWrapper } from "./SessionSyncWrapper";
import { ThemeProvider } from "~/lib/theme-provider";

export const metadata: Metadata = {
  title: "Voice Libre",
  description: "Free your voice",
  icons: [{ rel: "icon", url: "/favicon.ico" }],

  openGraph: {
    title: "Voice Libre",
    description: "Free Your Voice",
    url: "https://voicelibre.com",
    siteName: "Voice Libre",
    images: [
      {
        url: "https://voicelibre.com/img/preview.jpg",
        width: 1200,
        height: 1200,
        alt: "Voice Libre Voice to Voice AI Experience",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary",
    title: "Voice Libre",
    description: "Free Your Voice",
    images: ["https://voicelibre.com/img/preview.jpg"],
    creator: "@yourtwitterhandle",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={geist.variable}>
        <ThemeProvider>
          <SessionProvider>
            <SessionSyncWrapper>
              {/* Top Gradient */}
              <div
                className="pointer-events-none fixed top-0 right-0 left-0 z-30 h-16"
                style={{
                  background:
                    "linear-gradient(to bottom, rgb(var(--header-footer-bg)) 0%, rgba(var(--header-footer-bg), 0.6) 60%, rgba(var(--background), 0) 100%)",
                }}
              />

              {/* Bottom Gradient */}
              <div
                className="pointer-events-none fixed right-0 bottom-0 left-0 z-30 h-16"
                style={{
                  background:
                    "linear-gradient(to top, rgb(var(--header-footer-bg)) 0%, rgba(var(--header-footer-bg), 0.6) 60%, rgba(var(--background), 0) 100%)",
                }}
              />

              {children}
            </SessionSyncWrapper>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
