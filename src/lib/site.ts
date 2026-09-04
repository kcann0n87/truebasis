// Site-wide constants. Set NEXT_PUBLIC_SITE_URL on Vercel to the real domain
// (no trailing slash) so canonical URLs, the sitemap and Open Graph tags
// point at it; the fallback is the free Vercel URL.
export const SITE_NAME = "TrueBasis";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://truebasis.vercel.app").replace(/\/$/, "");
export const SITE_DESCRIPTION =
  "Drop in a brokerage activity statement and see, per stock, how much option premium you've collected and what your shares really cost you after it. Runs entirely in your browser — nothing is uploaded.";

export interface GuideMeta {
  slug: string;
  title: string; // <title> and H1
  description: string; // meta description, ~150 chars
  published: string; // YYYY-MM-DD
  updated: string;
  readMinutes: number;
}

export const GUIDES: GuideMeta[] = [
  {
    slug: "covered-call-cost-basis",
    title: "How to calculate your real cost basis on a covered call position",
    description:
      "The formula for adjusted cost basis after covered-call premium, a worked example with rolls and expirations, and the three mistakes that make most spreadsheets wrong.",
    published: "2026-09-04",
    updated: "2026-09-04",
    readMinutes: 7,
  },
  {
    slug: "put-assignment-cost-basis",
    title: "Assigned on a cash-secured put? Here's your real cost basis",
    description:
      "When a short put is assigned, the premium you collected is part of what you paid for the shares. How to compute it, how IBKR shows it, and what it means for the calls you sell next.",
    published: "2026-09-04",
    updated: "2026-09-04",
    readMinutes: 5,
  },
  {
    slug: "rolling-covered-calls",
    title: "Rolling covered calls: how to track the premium so you know where you stand",
    description:
      "A roll is a buyback plus a new sale. Track both halves against the right contract and the right shares, and a losing roll stops looking like a losing position.",
    published: "2026-09-04",
    updated: "2026-09-04",
    readMinutes: 6,
  },
];
