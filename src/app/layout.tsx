import type { Metadata } from "next";
import { Space_Grotesk, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--ff-display", display: "swap" });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--ff-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--ff-mono", display: "swap" });

export const metadata: Metadata = {
  title: "JobPacket — stop spraying, start sniping",
  description:
    "See why your resume gets auto-rejected, and fix it. India-first job scoring + honest AI tailoring. Local-first and free.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
