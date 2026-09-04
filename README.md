# TrueBasis

Upload a brokerage activity statement and see, per stock, how much option
premium you've collected against it and what the shares really cost you after
that premium: adjusted cost basis, adjusted cost per share, and the break-even
for the whole campaign.

**Runs entirely in the browser.** The statement is parsed and the numbers are
computed client-side; nothing is uploaded. Refresh and it's gone, unless the
user ticks "remember on this device" (localStorage only).

## What it handles

- IBKR Activity Statement CSVs and Robinhood activity-report CSVs (detected
  from the header). Overlapping statements are de-duplicated, so monthlies
  plus a YTD is fine. Robinhood trade rows are parsed per Robinhood's
  documented Trans Codes (Buy/Sell, STO/BTO/BTC/STC, OEXP, OASGN, OEXCS) but
  have not yet been verified against a real trade export — see
  `src/lib/robinhood.ts`.
- Average-cost share lots, put and call assignments as ordinary fills.
- Per-contract option lines with outcome (open / expired / closed / assigned)
  and rolls (buyback on the old line, new credit on the new one).
- "Only since current shares were acquired": premium counted from the fill that
  took the position from 0 to >0, so the put that got you assigned and calls on
  shares you no longer hold stay with the previous campaign.
- Contracts sold before the earliest uploaded statement use the broker's own
  realized P&L on the buyback, so a pre-history roll isn't shown as a loss.
- Per-ticker starting position for shares bought before the earliest statement,
  and per-fill exclusion for shares you don't want in the position.

## Develop

```
npm install
npm run dev      # http://localhost:3000
npm test         # fixture-driven accounting tests (node --experimental-strip-types)
npm run build
```

## Monetisation

Free tool; revenue is referrals and (later) ads.

- **Broker referral links** — `src/lib/affiliates.ts`. The IBKR link is
  built in and shown as a full-width banner under the upload area plus a card
  at the bottom; the Robinhood link is built in as a card. Override with
  `NEXT_PUBLIC_REF_IBKR` / `NEXT_PUBLIC_REF_ROBINHOOD`; tastytrade appears
  when `NEXT_PUBLIC_REF_TASTYTRADE` is set. Disclosure text is built in.
- **Ad slot** — `src/components/AdSlot.tsx`. Empty until an ad network tag is
  dropped in and `NEXT_PUBLIC_ADS=1` is set. Prefer a privacy-friendly network
  (Carbon, EthicalAds) to keep the "nothing leaves your browser" pitch honest.

`/privacy` and `/disclaimer` are static pages; keep them current if either of
the above changes.

## SEO

- `NEXT_PUBLIC_SITE_URL` (Vercel env) sets canonical URLs, the sitemap and
  Open Graph URLs — set it to the real domain, no trailing slash.
- `/robots.txt` and `/sitemap.xml` are generated (`src/app/robots.ts`,
  `src/app/sitemap.ts`). Add new guides to `GUIDES` in `src/lib/site.ts` and
  they join the sitemap and the guides index automatically.
- Structured data: WebApplication on every page (layout), Article on each
  guide (`GuideLayout`).

## Deploy

Static-friendly Next.js app; deploys to Vercel or Cloudflare Pages with no
configuration and no server state.
