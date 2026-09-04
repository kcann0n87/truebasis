// Broker referral links. Leave a url empty to hide that card. The IBKR and
// Robinhood links are Kyle's; any can be overridden via env:
//   NEXT_PUBLIC_REF_IBKR, NEXT_PUBLIC_REF_TASTYTRADE, NEXT_PUBLIC_REF_ROBINHOOD
// (read at build time — redeploy after changing them on Vercel).
export interface Affiliate {
  id: string;
  name: string;
  blurb: string;
  url: string;
}

export const AFFILIATES: Affiliate[] = [
  {
    id: "ibkr",
    name: "Interactive Brokers",
    blurb: "Cleanest statements for this tool, cheapest option commissions, and the broker this was built against.",
    url: process.env.NEXT_PUBLIC_REF_IBKR ?? "https://ibkr.com/referral/kyle858",
  },
  {
    id: "tastytrade",
    name: "tastytrade",
    blurb: "Built for options sellers — rolling and wheel workflows are first-class.",
    url: process.env.NEXT_PUBLIC_REF_TASTYTRADE ?? "",
  },
  {
    id: "robinhood",
    name: "Robinhood",
    blurb: "Simple covered calls with no per-contract commission. Sign up through this link to claim a free stock reward.",
    url: process.env.NEXT_PUBLIC_REF_ROBINHOOD ?? "https://join.robinhood.com/kylec1454",
  },
].filter((a) => a.url);
