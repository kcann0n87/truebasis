// Robinhood account-activity CSV → CcTrade[] (Kyle 9/3).
//
// Export: Robinhood app/web → Account → Reports and statements → Activity
// reports → CSV. Header (verified against a real export):
//   "Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"
// Money is "$1,234.56" or "($1,234.56)" for outflows. Dates are M/D/YYYY with
// no time, and rows are newest-first.
//
// Trans Codes we care about (documented Robinhood codes; the trade rows are
// NOT yet verified against a real trade export — the sample we had contained
// only cash/interest/dividend rows):
//   Buy / Sell      stock fills (also the stock leg of an assignment / exercise)
//   STO / BTO       option sell-/buy-to-open
//   BTC / STC       option buy-/sell-to-close
//   OEXP            option expired            (description "Option Expiration for …")
//   OASGN           option assigned           (description "Option Assignment for …")
//   OEXCS           option exercised          (description "Option Exercise for …")
// Option description: "AAPL 6/20/2026 Call $200".
//
// Robinhood gives no timestamps and no per-fill realized P&L. Times are
// synthesised so same-day events sort sensibly (assignment stock leg first,
// then buybacks, then new opens, then expirations), and realizedPL is 0 with
// realizedKnown=false so the accounting falls back to cash flow.

import type { CcTrade } from "./covered-calls.ts";

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

export function isRobinhoodCsv(text: string): boolean {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  return /"?Activity Date"?\s*,\s*"?Process Date"?\s*,\s*"?Settle Date"?/.test(first) && /Trans Code/.test(first);
}

// "$1,234.56" → 1234.56 ; "($1,234.56)" → −1234.56 ; "" → 0
function money(s: string | undefined): number {
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s.trim());
  const n = parseFloat(s.replace(/[()$,\s]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

// "6/20/2026" → "2026-06-20"
function isoDate(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

// "AAPL 6/20/2026 Call $200" (optionally prefixed "Option Expiration for ")
function parseOptionDesc(desc: string): { ticker: string; right: "C" | "P"; strike: number; expiration: string } | null {
  const m = /([A-Z][A-Z0-9.]*)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(Call|Put)\s+\$([\d,]+(?:\.\d+)?)/.exec(desc);
  if (!m) return null;
  const exp = isoDate(m[2]);
  if (!exp) return null;
  return { ticker: m[1], right: m[3] === "Call" ? "C" : "P", strike: parseFloat(m[4].replace(/,/g, "")), expiration: exp };
}

const CODE_ORDER: Record<string, number> = {
  // hour used for the synthetic time of day; ties broken by reversed row index
  OASGN: 9, OEXCS: 9, ASSIGN_STOCK: 9,
  Buy: 10, Sell: 10,
  BTC: 11, STC: 11,
  STO: 12, BTO: 12,
  OEXP: 16,
};

export function parseRobinhoodTrades(text: string): { trades: CcTrade[]; minDate?: string; maxDate?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { trades: [] };
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const cDate = col("Activity Date"), cInst = col("Instrument"), cDesc = col("Description"), cCode = col("Trans Code"),
    cQty = col("Quantity"), cPrice = col("Price"), cAmt = col("Amount");
  if (cDate < 0 || cCode < 0) return { trades: [] };

  type Raw = { i: number; date: string; inst: string; desc: string; code: string; qty: number; price: number; amount: number };
  const rows: Raw[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    const date = isoDate(c[cDate] ?? "");
    if (!date) continue;
    rows.push({
      i,
      date,
      inst: (c[cInst] ?? "").trim(),
      desc: (c[cDesc] ?? "").trim(),
      code: (c[cCode] ?? "").trim(),
      qty: parseFloat((c[cQty] ?? "").replace(/,/g, "")) || 0,
      price: money(c[cPrice]),
      amount: money(c[cAmt]),
    });
  }
  const n = rows.length;
  const timeFor = (hour: number, i: number) => {
    // newest-first file: later rows are earlier in the day
    const secs = Math.max(0, n - i);
    const mm = Math.floor(secs / 60) % 60;
    const ss = secs % 60;
    return `${String(hour).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  // Assignments/exercises: the option row says which contract; the stock leg
  // is a plain Buy/Sell on the same day at the strike. Tag it so the lot
  // logic sees an "A" fill.
  const assignKeys = new Set<string>();
  for (const r of rows) {
    if (r.code !== "OASGN" && r.code !== "OEXCS") continue;
    const o = parseOptionDesc(r.desc);
    if (!o) continue;
    assignKeys.add(`${r.date}|${o.ticker}|${o.strike}`);
  }

  const trades: CcTrade[] = [];
  let minDate: string | undefined;
  let maxDate: string | undefined;
  for (const r of rows) {
    const code = r.code;
    minDate = !minDate || r.date < minDate ? r.date : minDate;
    maxDate = !maxDate || r.date > maxDate ? r.date : maxDate;
    if (code === "Buy" || code === "Sell") {
      if (!r.inst || r.qty === 0) continue;
      const isAssign = assignKeys.has(`${r.date}|${r.inst}|${r.price}`);
      const quantity = code === "Buy" ? r.qty : -r.qty;
      const proceeds = r.amount; // already signed: buys negative
      trades.push({
        asset: "stock",
        symbol: r.inst,
        ticker: r.inst,
        dateTime: `${r.date} ${timeFor(isAssign ? CODE_ORDER.ASSIGN_STOCK : CODE_ORDER[code], r.i)}`,
        quantity,
        price: r.price,
        proceeds,
        commission: 0, // Robinhood's Amount is already net of regulatory fees
        realizedPL: 0,
        realizedKnown: false,
        codes: isAssign ? ["A"] : [code === "Buy" ? "O" : "C"],
        netCash: Math.round(proceeds * 100) / 100,
      });
      continue;
    }
    if (["STO", "BTO", "BTC", "STC", "OEXP", "OASGN", "OEXCS"].includes(code)) {
      const o = parseOptionDesc(r.desc);
      if (!o || r.qty === 0) continue;
      const qtyAbs = Math.abs(r.qty);
      let quantity: number;
      let codes: string[];
      switch (code) {
        case "STO": quantity = -qtyAbs; codes = ["O"]; break;
        case "BTO": quantity = qtyAbs; codes = ["O"]; break;
        case "BTC": quantity = qtyAbs; codes = ["C"]; break;
        case "STC": quantity = -qtyAbs; codes = ["C"]; break;
        case "OEXP": quantity = qtyAbs; codes = ["C", "Ep"]; break; // assume short (covered-call / CSP seller)
        case "OASGN": quantity = qtyAbs; codes = ["A"]; break;
        default: quantity = -qtyAbs; codes = ["Ex"]; break; // OEXCS: long option exercised
      }
      const proceeds = r.amount;
      trades.push({
        asset: "option",
        symbol: `${o.ticker} ${o.expiration} ${o.strike} ${o.right}`,
        ticker: o.ticker,
        right: o.right,
        strike: o.strike,
        expiration: o.expiration,
        dateTime: `${r.date} ${timeFor(CODE_ORDER[code], r.i)}`,
        quantity,
        price: r.price,
        proceeds,
        commission: 0,
        realizedPL: 0,
        realizedKnown: false,
        codes,
        netCash: Math.round(proceeds * 100) / 100,
      });
    }
  }
  return { trades, minDate, maxDate };
}
