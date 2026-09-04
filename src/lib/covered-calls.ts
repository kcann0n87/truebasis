// ──────────────────────────────────────────────────────────────────────────
// Covered-call premium tracker (Kyle 9/3)
//
// Upload IBKR Activity Statement CSVs and, per underlying, figure out how much
// option premium has been collected against the shares so the "actual"
// average price of the stock can be worked out:
//
//   raw avg cost      = total cost of shares held / shares held   (average-cost method)
//   adjusted avg cost = (total cost − net option premium) / shares held
//   break-even        = (total cost − net option premium − realized stock P&L) / shares held
//
// Pure TypeScript with no Node or browser dependencies: it runs in the browser
// (statements never leave the user's machine) and in `npm test` via
// `node --experimental-strip-types`.
//
// IBKR CSV format reference (same as ibkr-import.ts): multi-section CSV where
// each row is `Section,Header|Data,...`. The Trades section emits one header
// per asset class. Stock assignments show up in Trades as ordinary stock fills
// with an "A" code (short call assigned → negative qty at the strike; short
// put assigned → positive qty at the strike).
// ──────────────────────────────────────────────────────────────────────────


// ── Types ─────────────────────────────────────────────────────────────────

export interface CcTrade {
  asset: "stock" | "option";
  symbol: string; // raw IBKR symbol ("NVDA" or "NVDA 19SEP25 130 C")
  ticker: string; // underlying
  right?: "C" | "P";
  strike?: number;
  expiration?: string; // YYYY-MM-DD
  dateTime: string; // "YYYY-MM-DD HH:MM:SS" wall clock as printed by IBKR
  quantity: number; // signed: + buy, − sell (shares or contracts)
  price: number; // T. Price
  proceeds: number; // signed cash: + received, − paid
  commission: number; // negative
  realizedPL: number; // IBKR's own (FIFO lot) realized P/L for the fill
  codes: string[];
  netCash: number; // proceeds + commission
}

export interface CcStatement {
  id: string; // sha1 of the CSV text — dedupes re-uploads of the same file
  fileName: string;
  accountId?: string;
  period?: string; // e.g. "June 1, 2026 - June 30, 2026"
  periodStart?: string; // YYYY-MM-DD (parsed from period; undefined if unparseable)
  periodEnd?: string;
  uploadedAt: string;
  trades: CcTrade[];
  // Stock quantity held at the START of the statement period, from the
  // Mark-to-Market Performance Summary "Prior Quantity" column. Used to warn
  // when the uploaded history doesn't cover the original share purchase.
  priorStockQty: Record<string, number>;
  // Stock open positions at END of period (Open Positions section): quantity
  // and IBKR's total cost basis. Used as a cross-check.
  openStock: Record<string, { quantity: number; costBasis: number }>;
}

export interface CcStartingPosition {
  shares: number;
  avgCost: number;
}

export interface CcOptionLeg {
  key: string; // ticker|right|strike|expiration
  right: "C" | "P";
  strike: number;
  expiration: string;
  openedAt: string;
  closedAt?: string;
  contracts: number; // max contracts ever short/long on this line (abs)
  netQty: number; // remaining signed contracts (0 = flat)
  openCredit: number; // cash received on opens (net of commission)
  closeDebit: number; // cash paid on closes (net of commission; positive number)
  netPremium: number; // openCredit − closeDebit (+ = collected)
  outcome: "open" | "expired" | "assigned" | "closed" | "exercised";
  // "fills": net premium is the cash flow of the fills we saw (open credit −
  // close debit). "ibkr-realized": no opening fill in the uploaded statements
  // (the contract was sold before the earliest one), so net premium is IBKR's
  // own Realized P/L on the closing fills, which already nets the original
  // credit — otherwise a buyback from a pre-history roll would look like a
  // pure loss.
  premiumSource: "fills" | "ibkr-realized";
  // netPremium when the contract was sold on/after CcTickerSummary.lotStart
  // (it belongs to the current lot), else 0. Always netPremium when the lot
  // started before the uploaded history.
  lotNetPremium: number;
  inLot: boolean; // contract was sold inside the current lot window
  fills: CcTrade[];
}

// Premium / realized figures over one window: the whole uploaded history, or
// only since the current lot of shares was acquired.
export interface CcPremiumWindow {
  callPremium: number; // net premium from calls (opens − buybacks), commissions included
  putPremium: number;
  netPremium: number; // calls + puts
  stockRealizedPnl: number; // realized P&L on sells / assignments (avg-cost, IBKR fallback)
  callsWritten: number; // contracts sold-to-open
  putsWritten: number;
  adjustedAvgCost: number | null; // (totalCost − netPremium) / shares
  adjustedAvgCostCallsOnly: number | null; // (totalCost − callPremium) / shares
  breakEven: number | null; // (totalCost − netPremium − stockRealizedPnl) / shares
  breakEvenCallsOnly: number | null;
  totalPnlIfFlat: number | null; // when sharesHeld === 0: netPremium + stockRealizedPnl
}

export interface CcStockFill {
  fillKey: string; // stable id for this fill (symbol|dateTime|qty|price|proceeds|commission)
  excluded: boolean; // user chose to leave this fill out of the position (Kyle 9/3: CRCL bought 100 on top of 1000 assigned)
  dateTime: string;
  quantity: number;
  price: number;
  netCash: number;
  codes: string[];
  isAssignment: boolean;
  realizedPL: number; // our average-cost realized P&L on this fill (0 for buys)
  avgCostAfter: number;
  sharesAfter: number;
}

export interface CcTickerSummary {
  ticker: string;
  sharesHeld: number;
  totalCost: number; // average-cost basis of shares currently held
  rawAvgCost: number | null;
  // When the CURRENT lot of shares started — the fill that took the position
  // from 0 to >0 (a buy, or a put assignment). Undefined when the shares were
  // already held before the earliest uploaded statement (or via a starting-
  // position override), in which case `lot` equals `lifetime`.
  lotStart?: string;
  lifetime: CcPremiumWindow; // everything in the uploaded statements
  lot: CcPremiumWindow; // only since lotStart (Kyle 9/3: "after the shares were assigned")
  openCalls: number; // contracts currently short
  openPuts: number;
  firstTradeAt?: string;
  lastTradeAt?: string;
  legs: CcOptionLeg[];
  stockFills: CcStockFill[];
  startingPosition?: CcStartingPosition;
  // Warnings about incomplete history etc.
  warnings: string[];
  // What IBKR says the position is at the end of the latest statement
  ibkrOpenQty?: number;
  ibkrOpenCostBasis?: number;
}

export interface CcTotals {
  callPremium: number;
  putPremium: number;
  netPremium: number;
  stockRealizedPnl: number;
}

export interface CcReport {
  statements: Array<Omit<CcStatement, "trades" | "priorStockQty" | "openStock"> & { tradeCount: number }>;
  tickers: CcTickerSummary[];
  overrides: Record<string, CcStartingPosition>;
  excludedFills: string[];
  totals: CcTotals; // lifetime
  lotTotals: CcTotals; // current-lot windows summed
}

// ── CSV parsing ───────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

const MONTH_NAMES: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
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

// "NVDA 19SEP25 130 C" → parts. Also tolerates decimal strikes.
export function parseOptionSymbol(
  sym: string,
): { ticker: string; right: "C" | "P"; strike: number; expiration: string } | null {
  const m = /^([A-Z][A-Z0-9.]*)\s+(\d{1,2})([A-Z]{3})(\d{2})\s+([\d.]+)\s+([CP])$/.exec(sym.trim());
  if (!m) return null;
  const [, ticker, dd, mon, yy, strike, right] = m;
  const mm = MONTHS[mon];
  if (!mm) return null;
  return {
    ticker,
    right: right as "C" | "P",
    strike: parseFloat(strike),
    expiration: `20${yy}-${mm}-${dd.padStart(2, "0")}`,
  };
}

// "2026-06-23, 10:39:44" → "2026-06-23 10:39:44" (wall clock, sortable)
function normalizeDateTime(s: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}),?\s*(\d{2}:\d{2}:\d{2})?$/.exec(s.trim());
  if (!m) return s.trim();
  return m[2] ? `${m[1]} ${m[2]}` : `${m[1]} 00:00:00`;
}

// "June 1, 2026 - June 30, 2026" or "June 30, 2026" → [start, end]
function parsePeriod(p: string | undefined): { start?: string; end?: string } {
  if (!p) return {};
  const parts = p.split(/\s+-\s+/).map((x) => x.trim());
  const toIso = (d: string): string | undefined => {
    const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(d);
    if (!m) return undefined;
    const mm = MONTH_NAMES[m[1].toLowerCase()];
    if (!mm) return undefined;
    return `${m[3]}-${mm}-${m[2].padStart(2, "0")}`;
  };
  if (parts.length === 1) {
    const d = toIso(parts[0]);
    return { start: d, end: d };
  }
  return { start: toIso(parts[0]), end: toIso(parts[1]) };
}

// Stable id for a statement's text (FNV-1a, 64-bit, hex) — dedupes re-uploads
// of the same file without needing node's crypto in the browser.
export function contentId(text: string): string {
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x01000193 >>> 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x0100019b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function num(s: string | undefined): number {
  if (s == null) return 0;
  const n = parseFloat(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function parseStatementCsv(text: string, fileName = "statement.csv"): CcStatement {
  const lines = text.split(/\r?\n/);
  const headers: Record<string, string[]> = {};
  const meta: Record<string, string> = {};
  const trades: CcTrade[] = [];
  const priorStockQty: Record<string, number> = {};
  const openStock: Record<string, { quantity: number; costBasis: number }> = {};

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const section = cells[0];
    const kind = cells[1];
    if (kind === "Header") {
      headers[section] = cells.slice(2);
      continue;
    }
    if (kind !== "Data") continue;
    const header = headers[section];
    if (!header) continue;
    const vals = cells.slice(2);
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i].trim()] = (vals[i] ?? "").trim();

    if (section === "Statement" || section === "Account Information") {
      if (row["Field Name"]) meta[row["Field Name"]] = row["Field Value"];
      continue;
    }

    if (section === "Trades") {
      const disc = row["DataDiscriminator"];
      if (disc && disc !== "Order") continue; // skip SubTotal / Total / ClosedLot rows
      const assetRaw = row["Asset Category"] || "";
      const isStock = assetRaw === "Stocks";
      const isOpt = assetRaw === "Equity and Index Options";
      if (!isStock && !isOpt) continue;
      const sym = row["Symbol"] || "";
      if (!sym) continue;
      const codes = (row["Code"] || "").split(";").map((c) => c.trim()).filter(Boolean);
      const quantity = num(row["Quantity"]);
      const proceeds = num(row["Proceeds"]);
      const commission = num(row["Comm/Fee"]);
      const base = {
        symbol: sym,
        dateTime: normalizeDateTime(row["Date/Time"] || ""),
        quantity,
        price: num(row["T. Price"]),
        proceeds,
        commission,
        realizedPL: num(row["Realized P/L"]),
        codes,
        netCash: round2(proceeds + commission),
      };
      if (isStock) {
        if (quantity === 0) continue;
        trades.push({ asset: "stock", ticker: sym, ...base });
      } else {
        const opt = parseOptionSymbol(sym);
        if (!opt || quantity === 0) continue;
        trades.push({
          asset: "option",
          ticker: opt.ticker,
          right: opt.right,
          strike: opt.strike,
          expiration: opt.expiration,
          ...base,
        });
      }
      continue;
    }

    if (section === "Mark-to-Market Performance Summary") {
      if (row["Asset Category"] !== "Stocks") continue;
      const sym = row["Symbol"];
      if (!sym || sym === "Total") continue;
      if (row["Prior Quantity"] !== undefined) priorStockQty[sym] = num(row["Prior Quantity"]);
      continue;
    }

    if (section === "Open Positions") {
      if (row["Asset Category"] !== "Stocks") continue;
      const disc = row["DataDiscriminator"];
      if (disc && disc !== "Summary") continue; // skip Lot rows
      const sym = row["Symbol"];
      if (!sym || sym === "Total") continue;
      openStock[sym] = { quantity: num(row["Quantity"]), costBasis: num(row["Cost Basis"]) };
      continue;
    }
  }

  const period = meta["Period"];
  const { start, end } = parsePeriod(period);
  return {
    id: contentId(text),
    fileName,
    accountId: meta["Account"],
    period,
    periodStart: start,
    periodEnd: end,
    uploadedAt: new Date().toISOString(),
    trades,
    priorStockQty,
    openStock,
  };
}

// ── Accounting ────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function tradeKey(t: CcTrade): string {
  return `${t.symbol}|${t.dateTime}|${t.quantity}|${t.price}|${t.proceeds}|${t.commission}`;
}

// Merge trades from every statement, dropping exact duplicates (the same fill
// shows up twice when a monthly and a YTD statement overlap).
export function mergeTrades(statements: CcStatement[]): CcTrade[] {
  const seen = new Set<string>();
  const out: CcTrade[] = [];
  for (const s of statements) {
    for (const t of s.trades) {
      const k = tradeKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  }
  out.sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  return out;
}

function legOutcome(leg: { netQty: number; fills: CcTrade[] }): CcOptionLeg["outcome"] {
  if (leg.netQty !== 0) return "open";
  const last = leg.fills[leg.fills.length - 1];
  const codes = last?.codes ?? [];
  if (codes.includes("A")) return "assigned";
  if (codes.includes("Ex")) return "exercised";
  if (codes.includes("Ep")) return "expired";
  return "closed";
}

export function buildReport(
  statements: CcStatement[],
  overrides: Record<string, CcStartingPosition> = {},
  excludedFills: Set<string> = new Set(),
): CcReport {
  const trades = mergeTrades(statements);
  const byTicker = new Map<string, CcTrade[]>();
  for (const t of trades) {
    const arr = byTicker.get(t.ticker) ?? [];
    arr.push(t);
    byTicker.set(t.ticker, arr);
  }
  // Tickers with an override but no trades still deserve a row.
  for (const tk of Object.keys(overrides)) if (!byTicker.has(tk)) byTicker.set(tk, []);

  // Earliest statement per ticker → prior quantity hint. Latest → open position.
  const sorted = [...statements].sort((a, b) =>
    (a.periodStart ?? "").localeCompare(b.periodStart ?? ""),
  );
  const earliest = sorted[0];
  const latestByTicker = new Map<string, { quantity: number; costBasis: number; periodEnd?: string }>();
  for (const s of sorted) {
    for (const [sym, pos] of Object.entries(s.openStock)) {
      const prev = latestByTicker.get(sym);
      if (!prev || (s.periodEnd ?? "") >= (prev.periodEnd ?? "")) {
        latestByTicker.set(sym, { ...pos, periodEnd: s.periodEnd });
      }
    }
  }

  const tickers: CcTickerSummary[] = [];
  for (const [ticker, tt] of byTicker) {
    const override = overrides[ticker];
    const warnings: string[] = [];

    // ── Stock: average-cost running position ──
    let shares = 0;
    let totalCost = 0;
    let stockRealized = 0;
    const priorQty = earliest?.priorStockQty[ticker] ?? 0;
    // Do we KNOW the position was flat when the uploaded history starts? Only
    // if there's no starting-position override and IBKR's earliest statement
    // says no shares were held coming in. Otherwise the current lot predates
    // the history and its window is the whole history.
    let knownFlat = !(override && override.shares > 0) && !(priorQty > 0);
    let lotStart: string | undefined;
    let lotStockRealized = 0;
    if (override && override.shares > 0) {
      shares = override.shares;
      totalCost = override.shares * override.avgCost;
    }
    const stockFills: CcStockFill[] = [];
    let excludedQty = 0; // net shares in excluded fills, so the IBKR cross-check still lines up
    for (const t of tt) {
      if (t.asset !== "stock") continue;
      const fillKey = tradeKey(t);
      if (excludedFills.has(fillKey)) {
        excludedQty += t.quantity;
        stockFills.push({
          fillKey,
          excluded: true,
          dateTime: t.dateTime,
          quantity: t.quantity,
          price: t.price,
          netCash: t.netCash,
          codes: t.codes,
          isAssignment: t.codes.includes("A"),
          realizedPL: 0,
          avgCostAfter: shares > 0 ? round4(totalCost / shares) : 0,
          sharesAfter: shares,
        });
        continue;
      }
      let realized = 0;
      if (t.quantity > 0) {
        // Buy (or put assignment): add shares at net cost.
        if (shares <= 1e-9 && knownFlat) {
          // A fresh lot begins here — premium before this point belongs to an
          // earlier campaign, not to these shares.
          lotStart = t.dateTime;
          lotStockRealized = 0;
        }
        shares += t.quantity;
        totalCost += -t.netCash; // netCash is negative for a buy
      } else {
        const q = -t.quantity;
        const avg = shares > 0 ? totalCost / shares : 0;
        const matched = Math.min(q, shares);
        if (q > shares + 1e-9) {
          // The shares being sold were bought before the uploaded history, so
          // we don't know their basis. IBKR does — its Realized P/L on the
          // fill uses the real lot cost — so take that for the whole fill
          // rather than booking the proceeds as pure profit (which sent
          // break-even negative on GOOG/QCOM, Kyle 9/3).
          realized = t.realizedPL;
          warnings.push(
            `Sold ${q} shares on ${t.dateTime.slice(0, 10)} but only ${shares} were on the books, ` +
              `so IBKR's own realized P&L (${t.realizedPL >= 0 ? "+" : "-"}$${Math.abs(t.realizedPL).toFixed(2)}) was used for that fill. ` +
              `Upload earlier statements or set a starting position for an exact basis.`,
          );
        } else {
          realized = t.netCash - avg * matched;
        }
        shares -= q;
        totalCost -= avg * matched;
        if (shares < 1e-9) {
          // Flat (short stock isn't modeled — clamp). The next buy starts a new lot.
          shares = 0;
          totalCost = 0;
          knownFlat = true;
        }
        stockRealized += realized;
        lotStockRealized += realized;
      }
      stockFills.push({
        fillKey,
        excluded: false,
        dateTime: t.dateTime,
        quantity: t.quantity,
        price: t.price,
        netCash: t.netCash,
        codes: t.codes,
        isAssignment: t.codes.includes("A"),
        realizedPL: round2(realized),
        avgCostAfter: shares > 0 ? round4(totalCost / shares) : 0,
        sharesAfter: shares,
      });
    }
    const inLot = (dt: string) => lotStart === undefined || dt >= lotStart;

    // ── Options: group by contract line ──
    const legMap = new Map<string, CcOptionLeg>();
    for (const t of tt) {
      if (t.asset !== "option") continue;
      const key = `${t.ticker}|${t.right}|${t.strike}|${t.expiration}`;
      let leg = legMap.get(key);
      if (!leg) {
        leg = {
          key,
          right: t.right!,
          strike: t.strike!,
          expiration: t.expiration!,
          openedAt: t.dateTime,
          contracts: 0,
          netQty: 0,
          openCredit: 0,
          closeDebit: 0,
          netPremium: 0,
          outcome: "open",
          premiumSource: "fills",
          lotNetPremium: 0,
          inLot: false,
          fills: [],
        };
        legMap.set(key, leg);
      }
      leg.fills.push(t);
      const isOpen = t.codes.includes("O");
      if (isOpen) leg.openCredit += t.netCash;
      else leg.closeDebit += -t.netCash;
      leg.netQty += t.quantity;
      leg.contracts = Math.max(leg.contracts, Math.abs(leg.netQty));
      if (leg.netQty === 0) leg.closedAt = t.dateTime;
    }
    const life = { callPremium: 0, putPremium: 0, callsWritten: 0, putsWritten: 0 };
    const lot = { callPremium: 0, putPremium: 0, callsWritten: 0, putsWritten: 0 };
    let openCalls = 0;
    let openPuts = 0;
    const legs: CcOptionLeg[] = [];
    for (const leg of legMap.values()) {
      leg.openCredit = round2(leg.openCredit);
      leg.closeDebit = round2(leg.closeDebit);
      const sawOpen = leg.fills.some((f) => f.codes.includes("O"));
      if (sawOpen) {
        leg.netPremium = round2(leg.openCredit - leg.closeDebit);
        // A contract belongs to the lot it was SOLD in. A call written before
        // the current lot started was written against the previous shares, so
        // the whole line — its buyback included — stays with that campaign.
        // (Counting only the post-lot fills charged pre-lot calls' buybacks to
        // the new lot with no credit, which showed up as a negative call
        // premium total on Kyle's real statements, 9/3.) A roll's buyback and
        // the new credit still both land inside the lot when both contracts
        // were sold after the lot started.
        leg.inLot = inLot(leg.openedAt);
        leg.lotNetPremium = leg.inLot ? leg.netPremium : 0;
      } else {
        // Sold before the earliest uploaded statement; only the close is here.
        // Its opening quantity is unknown, so assume the closes flattened it.
        leg.premiumSource = "ibkr-realized";
        leg.netPremium = round2(leg.fills.reduce((sum, f) => sum + f.realizedPL, 0));
        leg.openedAt = ""; // unknown — before uploaded history
        leg.netQty = 0;
        // Opened before history ⇒ before any lot that started inside history.
        leg.inLot = lotStart === undefined;
        leg.lotNetPremium = leg.inLot ? leg.netPremium : 0;
      }
      leg.outcome = legOutcome(leg);
      if (leg.outcome === "open") leg.closedAt = undefined;
      const soldAll = leg.fills.filter((f) => f.codes.includes("O") && f.quantity < 0);
      const sold = soldAll.reduce((s, f) => s + -f.quantity, 0);
      const soldLot = leg.inLot ? sold : 0;
      if (leg.right === "C") {
        life.callPremium += leg.netPremium;
        lot.callPremium += leg.lotNetPremium;
        life.callsWritten += sold;
        lot.callsWritten += soldLot;
        if (leg.netQty < 0) openCalls += -leg.netQty;
      } else {
        life.putPremium += leg.netPremium;
        lot.putPremium += leg.lotNetPremium;
        life.putsWritten += sold;
        lot.putsWritten += soldLot;
        if (leg.netQty < 0) openPuts += -leg.netQty;
      }
      legs.push(leg);
    }
    legs.sort((a, b) => (b.openedAt || b.closedAt || "").localeCompare(a.openedAt || a.closedAt || ""));

    // ── Incomplete-history warnings ──
    if (override && override.shares > 0 && earliest && ticker in earliest.priorStockQty && priorQty === 0) {
      // Kyle 9/3: CRCL — entered the 100 shares bought INSIDE the history as a
      // starting position, so they were counted twice (1200 vs IBKR's 1100).
      warnings.push(
        `Starting position of ${override.shares} shares is double counting: IBKR's earliest statement` +
          `${earliest.periodStart ? ` (${earliest.periodStart})` : ""} shows no ${ticker} held coming in, so those shares ` +
          `were bought inside the uploaded history and are already in the fills below. Clear the starting position; ` +
          `to leave a purchase out of the position, untick its Count box instead.`,
      );
    }
    if (!override && priorQty > 0) {
      warnings.push(
        `IBKR shows ${priorQty} share${Math.abs(priorQty) === 1 ? "" : "s"} already held before your earliest ` +
          `statement${earliest?.periodStart ? ` (${earliest.periodStart})` : ""}. ` +
          `Set a starting position with their average cost so the adjusted price is right.`,
      );
    }
    const ibkrOpen = latestByTicker.get(ticker);
    if (ibkrOpen && Math.abs(ibkrOpen.quantity - (shares + excludedQty)) > 1e-6) {
      warnings.push(
        `Computed ${shares + excludedQty} shares held but IBKR's latest statement` +
          `${ibkrOpen.periodEnd ? ` (${ibkrOpen.periodEnd})` : ""} shows ${ibkrOpen.quantity}. ` +
          `Some fills are probably missing from the uploaded statements.`,
      );
    }

    const has = shares > 0;
    const window = (w: typeof life, realized: number): CcPremiumWindow => {
      const callPremium = round2(w.callPremium);
      const putPremium = round2(w.putPremium);
      const netPremium = round2(callPremium + putPremium);
      const stockRealizedPnl = round2(realized);
      return {
        callPremium,
        putPremium,
        netPremium,
        stockRealizedPnl,
        callsWritten: w.callsWritten,
        putsWritten: w.putsWritten,
        adjustedAvgCost: has ? round4((totalCost - netPremium) / shares) : null,
        adjustedAvgCostCallsOnly: has ? round4((totalCost - callPremium) / shares) : null,
        breakEven: has ? round4((totalCost - netPremium - stockRealizedPnl) / shares) : null,
        breakEvenCallsOnly: has ? round4((totalCost - callPremium - stockRealizedPnl) / shares) : null,
        totalPnlIfFlat: has ? null : round2(netPremium + stockRealizedPnl),
      };
    };
    const lifetime = window(life, stockRealized);
    // A flat position has no "current lot": show the whole campaign.
    const lotWindow = has && lotStart !== undefined ? window(lot, lotStockRealized) : lifetime;
    tickers.push({
      ticker,
      sharesHeld: shares,
      totalCost: round2(totalCost),
      rawAvgCost: has ? round4(totalCost / shares) : null,
      lotStart: has ? lotStart : undefined,
      lifetime,
      lot: lotWindow,
      openCalls,
      openPuts,
      firstTradeAt: tt[0]?.dateTime,
      lastTradeAt: tt[tt.length - 1]?.dateTime,
      legs,
      stockFills,
      startingPosition: override,
      warnings,
      ibkrOpenQty: ibkrOpen?.quantity,
      ibkrOpenCostBasis: ibkrOpen?.costBasis,
    });
  }

  // Shares held first, then by premium collected on the current lot.
  tickers.sort((a, b) => {
    const ah = a.sharesHeld > 0 ? 1 : 0;
    const bh = b.sharesHeld > 0 ? 1 : 0;
    if (ah !== bh) return bh - ah;
    return b.lot.netPremium - a.lot.netPremium;
  });

  const sumTotals = (pick: (t: CcTickerSummary) => CcPremiumWindow): CcTotals => {
    const acc: CcTotals = { callPremium: 0, putPremium: 0, netPremium: 0, stockRealizedPnl: 0 };
    for (const t of tickers) {
      const w = pick(t);
      acc.callPremium += w.callPremium;
      acc.putPremium += w.putPremium;
      acc.netPremium += w.netPremium;
      acc.stockRealizedPnl += w.stockRealizedPnl;
    }
    for (const k of Object.keys(acc) as Array<keyof CcTotals>) acc[k] = round2(acc[k]);
    return acc;
  };
  const totals = sumTotals((t) => t.lifetime);
  const lotTotals = sumTotals((t) => t.lot);

  return {
    statements: sorted.map((s) => ({
      id: s.id,
      fileName: s.fileName,
      accountId: s.accountId,
      period: s.period,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      uploadedAt: s.uploadedAt,
      tradeCount: s.trades.length,
    })),
    tickers,
    overrides,
    excludedFills: Array.from(excludedFills),
    totals,
    lotTotals,
  };
}
