# TrueBasis

Upload a brokerage activity statement and see, per stock, how much option
premium you've collected against it and what the shares really cost you after
that premium: adjusted cost basis, adjusted cost per share, and the break-even
for the whole campaign.

**Runs entirely in the browser.** The statement is parsed and the numbers are
computed client-side; nothing is uploaded. Refresh and it's gone, unless the
user ticks "remember on this device" (localStorage only).

## What it handles

- IBKR Activity Statement CSVs (more brokers to come). Overlapping statements
  are de-duplicated, so monthlies plus a YTD is fine.
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
  at the bottom; override with `NEXT_PUBLIC_REF_IBKR`. Other brokers appear
  as cards when `NEXT_PUBLIC_REF_TASTYTRADE` / `NEXT_PUBLIC_REF_ROBINHOOD`
  are set. Disclosure text is built in.
- **Ad slot** — `src/components/AdSlot.tsx`. Empty until an ad network tag is
  dropped in and `NEXT_PUBLIC_ADS=1` is set. Prefer a privacy-friendly network
  (Carbon, EthicalAds) to keep the "nothing leaves your browser" pitch honest.

`/privacy` and `/disclaimer` are static pages; keep them current if either of
the above changes.

## Deploy

Static-friendly Next.js app; deploys to Vercel or Cloudflare Pages with no
configuration and no server state.
