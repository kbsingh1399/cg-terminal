import type { Metadata } from "next";
// self-hosted Geist (npm `geist`) — identical to the Google-Fonts copy but
// bundles the woff2 files, so `next build` works fully OFFLINE
// (next/font/google fetches from fonts.googleapis.com at build time)
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "BTC Order-Flow Terminal — Footprint · Large Orders · Liquidation Levels",
  description:
    "Live BTC derivatives analytics: footprint order flow, large order book statistics and liquidation levels, fed by the Coinglass data APIs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-[#0b0e11] text-neutral-200`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
