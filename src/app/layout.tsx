import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const description =
  "Drop in a brokerage activity statement and see, per stock, how much option premium you've collected and what your shares really cost you after it. Runs entirely in your browser — nothing is uploaded.";

export const metadata: Metadata = {
  title: "TrueBasis — your real cost basis after covered-call premium",
  description,
  openGraph: {
    title: "TrueBasis — your real cost basis after covered-call premium",
    description,
    type: "website",
    siteName: "TrueBasis",
  },
  twitter: { card: "summary", title: "TrueBasis", description },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
