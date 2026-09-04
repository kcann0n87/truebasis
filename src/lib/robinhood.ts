// Robinhood account-activity CSV → CcTrade[] (Kyle 9/3, rewritten 9/4 against
// a real 1,287-row export).
//
// Export: Robinhood → Account → Reports and statements → Activity reports →
// CSV. Header:
//   "Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"
//
// What the real file taught us, and what the first pass got wrong:
//   * Stock rows carry a MULTI-LINE quoted Description ("Meta Platforms\n
//     CUSIP: 30303M102"), so the file cannot be split into lines before
//     parsing — quotes have to be tracked across newlines.
//   * Quantity can carry an "S" suffix on non-cash events ("8S", "15S") and
//     can be fractional ("199.682291").
//   * Money is "$1,234.56", "($1,234.56)" for outflows, or empty.
//   * OEXP / OEXCS carry no Amount and no Price. They close whatever position
//     is open on that contract, so their DIRECTION has to come from the net
//     position built from earlier rows — a long call expiring worthless and a
//     short call expiring worthless are opposite signs. (The first pass
//     assumed short, which is wrong for anyone who buys options.)
//   * Option assignment appears as OASGN in Robinhood's docs; this export had
//     none, so that path stays untested — it is handled the same way as
//     OEXCS: close the option line, and the paired stock leg is a Buy/Sell on
//     the same day at the strike, which gets tagged as the assignment fill.
//   * OCA (option corporate action, e.g. a ticker change) moves a position
//     between symbols with no cash; both legs are skipped so premium isn't
//     invented, and the underlying's own OCA/SXCH stock legs are skipped too.
//
// Robinhood reports no timestamps and no per-fill realized P&L. Times are
// synthesised so same-day events sort sensibly, and realizedKnown=false makes
// the accounting fall back to cash flow.

import type { CcTrade } from "./covered-calls.ts";

// Splits a whole CSV into rows of fields, honouring quoted fields that
// contain commas OR newlines.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  const src = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') {
      if (inQ && src[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" && !inQ) {
      row.push(cur);
      cur = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export function isRobinhoodCsv(text: string): boolean {
  const head = text.replace(/^﻿/, "").slice(0, 400);
  return /"?Activity Date"?\s*,\s*"?Process Date"?\s*,\s*"?Settle Date"?/.test(head) && /Trans Code/.test(head);
}

// "$1,234.56" → 1234.56 ; "($1,234.56)" → −1234.56 ; "" → 0
function money(s: string | undefined): number {
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s.trim());
  const n = parseFloat(s.replace(/[()$,\s]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

// "8S" → 8 ; "199.682291" → 199.682291 ; "" → 0
function qty(s: string | undefined): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[,\s]/g, "").replace(/S$/i, ""));
  return Number.isFinite(n) ? n : 0;
}

// "6/20/2026" → "2026-06-20"
function isoDate(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

// "EWY 5/15/2020 Put $50.00", with or without a leading
// "Option Expiration for " / "Option Assignment for ".
function parseOptionDesc(desc: string): { ticker: string; right: "C" | "P"; strike: number; expiration: string } | null {
  const m = /([A-Z][A-Z0-9.]*)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(Call|Put)\s+\$([\d,]+(?:\.\d+)?)/.exec(desc);
  if (!m) return null;
  const exp = isoDate(m[2]);
  if (!exp) return null;
  return { ticker: m[1], right: m[3] === "Call" ? "C" : "P", strike: parseFloat(m[4].replace(/,/g, "")), expiration: exp };
}

const OPTION_CODES = new Set(["STO", "BTO", "BTC", "STC", "OEXP", "OASGN", "OEXCS"]);
// Hour used for the synthetic time of day, so same-day events order sensibly.
const HOUR: Record<string, number> = {
  ASSIGN_STOCK: 9, Buy: 10, Sell: 10, BTC: 11, STC: 11, STO: 12, BTO: 12,
  OASGN: 15, OEXCS: 15, OEXP: 16,
};

export function parseRobinhoodTrades(text: string): { trades: CcTrade[]; minDate?: string; maxDate?: string } {
  const rows = parseCsv(text);
  if (rows.length === 0) return { trades: [] };
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const cDate = idx("Activity Date"), cInst = idx("Instrument"), cDesc = idx("Description"),
    cCode = idx("Trans Code"), cQty = idx("Quantity"), cPrice = idx("Price"), cAmt = idx("Amount");
  if (cDate < 0 || cCode < 0) return { trades: [] };

  interface Raw { i: number; date: string; inst: string; desc: string; code: string; q: number; price: number; amount: number }
  const raw: Raw[] = [];
  for (let i = 1; i < rows.length; i++) {
    const c = rows[i];
    const date = isoDate(c[cDate] ?? "");
    if (!date) continue;
    raw.push({
      i,
      date,
      inst: (c[cInst] ?? "").trim(),
      desc: (c[cDesc] ?? "").trim(),
      code: (c[cCode] ?? "").trim(),
      q: qty(c[cQty]),
      price: money(c[cPrice]),
      amount: money(c[cAmt]),
    });
  }
  // The file is newest-first; walk oldest-first so running positions build up.
  const ordered = [...raw].reverse();
  const n = ordered.length;
  const timeFor = (hour: number, seq: number) => {
    const mm = Math.floor(seq / 60) % 60;
    const ss = seq % 60;
    return `${String(hour).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  // Contracts moved by an option corporate action: skip both legs so a ticker
  // change doesn't read as premium.
  const ocaKeys = new Set<string>();
  for (const r of ordered) {
    if (r.code !== "OCA") continue;
    const o = parseOptionDesc(r.desc);
    if (o) ocaKeys.add(`${o.ticker}|${o.right}|${o.strike}|${o.expiration}`);
  }
  // Same-day assignments, so the paired stock leg can be tagged.
  const assignKeys = new Set<string>();
  for (const r of ordered) {
    if (r.code !== "OASGN" && r.code !== "OEXCS") continue;
    const o = parseOptionDesc(r.desc);
    if (o) assignKeys.add(`${r.date}|${o.ticker}|${o.strike}`);
  }

  const trades: CcTrade[] = [];
  const netQty = new Map<string, number>(); // running signed contracts per option line
  let minDate: string | undefined;
  let maxDate: string | undefined;
  let seq = 0;

  for (const r of ordered) {
    seq++;
    minDate = !minDate || r.date < minDate ? r.date : minDate;
    maxDate = !maxDate || r.date > maxDate ? r.date : maxDate;

    if (r.code === "Buy" || r.code === "Sell") {
      if (!r.inst || r.q === 0) continue;
      const isAssign = assignKeys.has(`${r.date}|${r.inst}|${r.price}`);
      const quantity = r.code === "Buy" ? r.q : -r.q;
      trades.push({
        asset: "stock",
        symbol: r.inst,
        ticker: r.inst,
        dateTime: `${r.date} ${timeFor(isAssign ? HOUR.ASSIGN_STOCK : HOUR[r.code], n - seq)}`,
        quantity,
        price: r.price,
        proceeds: r.amount,
        commission: 0, // Robinhood's Amount is already net of regulatory fees
        realizedPL: 0,
        realizedKnown: false,
        codes: isAssign ? ["A"] : [r.code === "Buy" ? "O" : "C"],
        netCash: Math.round(r.amount * 100) / 100,
      });
      continue;
    }

    if (!OPTION_CODES.has(r.code)) continue; // INT, CDIV, ACH, GOLD, OCA, SPR, SXCH, …
    const o = parseOptionDesc(r.desc);
    if (!o || r.q === 0) continue;
    const key = `${o.ticker}|${o.right}|${o.strike}|${o.expiration}`;
    if (ocaKeys.has(key)) continue;

    const qAbs = Math.abs(r.q);
    let quantity: number;
    let codes: string[];
    switch (r.code) {
      case "STO": quantity = -qAbs; codes = ["O"]; break;
      case "BTO": quantity = qAbs; codes = ["O"]; break;
      case "BTC": quantity = qAbs; codes = ["C"]; break;
      case "STC": quantity = -qAbs; codes = ["C"]; break;
      default: {
        // OEXP / OASGN / OEXCS close whatever is open: a short line is bought
        // back (+), a long line is sold off (−). Robinhood gives no side here,
        // so take it from the running position.
        const open = netQty.get(key) ?? 0;
        quantity = open < 0 ? qAbs : -qAbs;
        codes = r.code === "OEXP" ? ["C", "Ep"] : r.code === "OASGN" ? ["A"] : ["Ex"];
        break;
      }
    }
    netQty.set(key, (netQty.get(key) ?? 0) + quantity);
    trades.push({
      asset: "option",
      symbol: `${o.ticker} ${o.expiration} ${o.strike} ${o.right}`,
      ticker: o.ticker,
      right: o.right,
      strike: o.strike,
      expiration: o.expiration,
      dateTime: `${r.date} ${timeFor(HOUR[r.code], n - seq)}`,
      quantity,
      price: r.price,
      proceeds: r.amount,
      commission: 0,
      realizedPL: 0,
      realizedKnown: false,
      codes,
      netCash: Math.round(r.amount * 100) / 100,
    });
  }
  return { trades, minDate, maxDate };
}
