import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { connection } from "next/server";
import { getSetting } from "@/lib/settings";
import "./globals.css";

const sans = Inter({ variable: "--font-sans-body", subsets: ["latin"] });
const display = Playfair_Display({ variable: "--font-display-serif", subsets: ["latin"], style: ["normal", "italic"] });

export async function generateMetadata(): Promise<Metadata> {
  await connection(); // never read the database at build time
  const site = await getSetting("site");
  return {
    title: { default: site.brandName, template: `%s | ${site.brandName}` },
    description: site.tagline,
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e1a16" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page renders per request: the CSP nonce must be fresh and content is admin-editable.
  await connection();
  const site = await getSetting("site");
  const brandVars = { "--brand": site.primaryColour, "--accent": site.accentColour } as CSSProperties;
  return (
    <html lang="en-GB" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cream font-sans text-ink" style={brandVars}>
        {children}
      </body>
    </html>
  );
}
