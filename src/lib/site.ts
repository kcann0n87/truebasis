import type { Metadata } from "next";

// Site-wide constants. NEXT_PUBLIC_SITE_URL overrides the canonical origin
// (no trailing slash) for preview deploys; production is optionbasis.com.
export const SITE_NAME = "OptionBasis";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://optionbasis.com").replace(/\/$/, "");
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

// Metadata for a /guides/<slug> page. Keeps canonical, Open Graph type and
// the article timestamps in step across every guide — Google reads
// article:published_time / article:modified_time from the OG tags as well as
// from the JSON-LD, and a guide that disagrees with itself is worse than one
// that says nothing.
export function guideMetadata(slug: string): Metadata {
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) throw new Error(`Unknown guide slug: ${slug}`);
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/guides/${g.slug}` },
    openGraph: {
      title: g.title,
      description: g.description,
      type: "article",
      url: `/guides/${g.slug}`,
      publishedTime: g.published,
      modifiedTime: g.updated,
      authors: [SITE_NAME],
    },
  };
}

// Home-page FAQ. Rendered on the page AND emitted as FAQPage structured data,
// which is what Google needs to consider it for a rich result. Keep the two in
// step: schema that doesn't match visible copy is a manual-action risk.
export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "How do you calculate cost basis after selling covered calls?",
    a: "Take what you paid for the shares you still hold and subtract the net option premium: every credit from selling calls, minus every debit from buying them back, minus commissions. Divide by shares held for the adjusted cost per share. If the shares arrived by put assignment, the strike is reduced by that put's premium first.",
  },
  {
    q: "Does covered call premium reduce my cost basis for taxes?",
    a: "No. Premium from a call that expires worthless is its own short-term capital gain; it does not change the shares' tax basis. Premium from a put that is assigned does reduce the basis of the shares you acquire. The adjusted basis this tool shows is a trading view for decisions, not a tax figure — use your broker's tax documents for filing.",
  },
  {
    q: "Is my brokerage statement uploaded anywhere?",
    a: "No. The file is read and parsed by JavaScript in your own browser. There is no upload endpoint, no account and no server-side storage. Close the tab and it is gone unless you tick 'remember on this device', which uses your browser's local storage only.",
  },
  {
    q: "Which brokers are supported?",
    a: "Interactive Brokers activity statements and Robinhood activity reports, both as CSV. Overlapping statements are de-duplicated, so you can upload a year of monthly files plus a year-to-date one without double counting.",
  },
  {
    q: "How is a rolled covered call counted?",
    a: "A roll is two trades. The buyback is a debit against the contract you closed and the new sale is a credit on the new contract, so a roll for a net debit shows as a cost on the old line and premium on the new one. Both count toward the shares, which keeps a losing roll from looking like a losing position.",
  },
];
