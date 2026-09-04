// Reader support ("buy me a coffee"). OptionBasis is free and has no accounts,
// so the only ways money comes in are broker referrals, ads, and this.
//
// Set NEXT_PUBLIC_DONATE_URL on Vercel to your payment page and every donate
// affordance on the site turns on. Anything that gives you a plain link works:
//   Ko-fi          https://ko-fi.com/<you>
//   Buy Me a Coffee https://buymeacoffee.com/<you>
//   Stripe Payment Link https://buy.stripe.com/<id>
//   GitHub Sponsors https://github.com/sponsors/<you>
//   PayPal.me      https://paypal.me/<you>
// Read at build time, so redeploy after changing it.
const url = (process.env.NEXT_PUBLIC_DONATE_URL ?? "").trim();

// Label for the button; keep it short, it sits in the header.
const label = (process.env.NEXT_PUBLIC_DONATE_LABEL ?? "Buy me a coffee").trim();

export const SUPPORT: { url: string; label: string } | null = url ? { url, label } : null;
