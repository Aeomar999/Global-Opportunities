import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { BRAND, BRAND_ADMIN_TITLE } from "@/config/brand";
import "./globals.css";

// Body font: Inter 400 / 500 / 600. Exposed as --font-inter, consumed by --font-sans in
// globals.css. display: "swap" shows the system fallback immediately, then swaps in Inter.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
});

// Display font for headings, card titles and KPI numbers: Plus Jakarta Sans 600 / 700 / 800.
// Exposed as --font-jakarta, consumed by --font-display in globals.css.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: BRAND_ADMIN_TITLE,
  description: `${BRAND.sub} administration dashboard`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      {/* suppressHydrationWarning (one level only): browser extensions add attributes to <html> and <body> before React
          hydrates, which Next.js dev reports as an issue. Nothing below these two tags is affected. */}
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-canvas text-ink">{children}</body>
    </html>
  );
}
