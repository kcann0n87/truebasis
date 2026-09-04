"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  buildReport,
  parseStatementCsv,
  type CcOptionLeg,
  type CcPremiumWindow,
  type CcReport,
  type CcStartingPosition,
  type CcStatement,
  type CcTickerSummary,
} from "@/lib/covered-calls";
import Link from "next/link";
import { clearStored, loadStored, saveStored } from "@/lib/local-store";
import { DEMO_STATEMENTS } from "@/lib/demo";
import { FAQ } from "@/lib/site";
import { FaqSchema } from "@/components/FaqSchema";
import { Referrals } from "@/components/Referrals";
import { ReferralBanner } from "@/components/ReferralBanner";
import { AdSlot } from "@/components/AdSlot";
import { DonatePanel } from "@/components/DonateButton";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

// OptionBasis — upload a brokerage activity statement, see per stock how much
// option premium you've collected and what the shares really cost you.
// Everything runs in the browser: the statement is parsed here, the numbers
// are computed here, and nothing is sent anywhere. Refresh and it's gone,
// unless "remember on this device" is ticked (then it lives in localStorage).

const money = (n: number | null | undefined, digits = 2) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};
const signed = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${money(n)}`;
};
const pnlClass = (n: number | null | undefined) =>
  n == null ? "text-gray-400" : n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-gray-400";

function Stat({ label, value, hint, cls }: { label: string; value: string; hint?: string; cls?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
      <div className="text-xs text-gray-500 uppercase">{label}</div>
      <div className={`text-xl font-bold font-mono ${cls ?? "text-gray-100"}`}>{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function Th({ children, right, title }: { children: ReactNode; right?: boolean; title?: string }) {
  return (
    <th
      title={title}
      className={`px-2 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold whitespace-nowrap ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({ children, right, cls }: { children: ReactNode; right?: boolean; cls?: string }) {
  return (
    <td className={`px-2 py-1.5 font-mono text-xs whitespace-nowrap ${right ? "text-right" : "text-left"} ${cls ?? ""}`}>
      {children}
    </td>
  );
}

// Columns the by-stock table can be sorted on. `null` keeps the order the
// report produced (largest position first).
type SortKey =
  | "ticker" | "shares" | "lot" | "cost" | "call" | "put"
  | "premPct" | "basis" | "adjBasis" | "adj" | "be" | "open" | "written";
interface Sort { key: SortKey | null; dir: "asc" | "desc" }

// A table row with everything the current toggles imply already worked out,
// so the table, the mobile cards, the sort and the CSV export all agree.
interface Row {
  t: CcTickerSummary;
  w: CcPremiumWindow;
  prem: number; // premium counted toward basis under the current toggles
  adj: number | null; // adjusted cost per share
  be: number | null; // break-even per share
  premPct: number | null;
  adjBasis: number | null;
}

function SortTh({
  k, sort, onSort, children, right, title, sticky,
}: {
  k: SortKey;
  sort: Sort;
  onSort: (k: SortKey) => void;
  children: ReactNode;
  right?: boolean;
  title?: string;
  sticky?: boolean; // pins with the column below it while the table scrolls
}) {
  const active = sort.key === k;
  return (
    <th
      title={title}
      onClick={() => onSort(k)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap cursor-pointer select-none hover:text-gray-200 ${
        active ? "text-emerald-400" : "text-gray-500"
      } ${right ? "text-right" : "text-left"} ${sticky ? "sticky left-0 z-10 bg-gray-900" : ""}`}
    >
      {children}
      <span className={active ? "" : "text-gray-700"}>{active ? (sort.dir === "asc" ? " ▲" : " ▼") : " ⇅"}</span>
    </th>
  );
}

const OUTCOME_STYLE: Record<CcOptionLeg["outcome"], string> = {
  open: "bg-blue-500/15 text-blue-300",
  expired: "bg-emerald-500/15 text-emerald-300",
  closed: "bg-gray-500/20 text-gray-300",
  assigned: "bg-yellow-500/15 text-yellow-300",
  exercised: "bg-orange-500/15 text-orange-300",
};

function StartingPositionForm({
  t,
  onSave,
}: {
  t: CcTickerSummary;
  onSave: (ticker: string, pos: CcStartingPosition | null) => void;
}) {
  const [shares, setShares] = useState(t.startingPosition ? String(t.startingPosition.shares) : "");
  const [avgCost, setAvgCost] = useState(t.startingPosition ? String(t.startingPosition.avgCost) : "");
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded p-3 text-xs">
      <div className="text-gray-300 font-semibold mb-1">
        Starting position (before your earliest statement)
        {t.startingPositionSource === "estimated" && <span className="ml-2 font-normal text-gray-500">currently estimated from the broker&apos;s cost basis</span>}
      </div>
      <div className="text-gray-500 mb-2">
        Only for shares bought <em>before</em> the first uploaded statement, where the broker never shows the buy.
        Shares bought inside the statements are already counted — untick a fill&apos;s Count box to leave one out instead.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          placeholder="Shares"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          className="w-28 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-gray-100"
        />
        <input
          type="number"
          inputMode="decimal"
          step="0.0001"
          placeholder="Avg cost"
          value={avgCost}
          onChange={(e) => setAvgCost(e.target.value)}
          className="w-28 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-gray-100"
        />
        <button
          disabled={!(Number(shares) > 0) || !(Number(avgCost) >= 0)}
          onClick={() => onSave(t.ticker, { shares: Number(shares), avgCost: Number(avgCost) })}
          className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-semibold"
        >
          Save
        </button>
        {t.startingPositionSource === "manual" && (
          <button
            onClick={() => { onSave(t.ticker, null); setShares(""); setAvgCost(""); }}
            className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function TickerDetail({
  t,
  w,
  prem,
  adj,
  sinceLot,
  onSaveStart,
  onToggleFill,
}: {
  t: CcTickerSummary;
  w: CcPremiumWindow;
  prem: number; // premium counted toward basis in the selected window (calls, or calls + puts)
  adj: number | null; // adjusted cost per share for the same selection
  sinceLot: boolean;
  onSaveStart: (ticker: string, pos: CcStartingPosition | null) => void;
  onToggleFill: (fillKey: string, excluded: boolean) => void;
}) {
  const lotActive = sinceLot && !!t.lotStart;
  const lotLabel = lotActive ? `since ${t.lotStart!.slice(0, 10)}` : "all history";
  return (
    <div className="px-2 sm:px-4 py-3 space-y-3 bg-gray-950/60 border-t border-gray-800">
      {t.warnings.length > 0 && (
        <div className="space-y-1">
          {t.warnings.map((wn, i) => (
            <div key={i} className="text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1">
              ⚠ {wn}
            </div>
          ))}
        </div>
      )}

      {t.notes.length > 0 && (
        <div className="space-y-1">
          {t.notes.map((nt, i) => (
            <div key={i} className="text-xs text-gray-400 bg-gray-900/60 border border-gray-800 rounded px-2 py-1">
              ℹ {nt}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat
          label="Shares held"
          value={t.sharesHeld.toLocaleString()}
          hint={t.lotStart ? `this lot since ${t.lotStart.slice(0, 10)}` : t.ibkrOpenQty != null ? `broker shows ${t.ibkrOpenQty}` : undefined}
        />
        <Stat
          label={`Adj. basis (${lotLabel})`}
          value={t.sharesHeld > 0 ? money(t.totalCost - prem) : "—"}
          hint={
            t.sharesHeld > 0
              ? `cost basis ${money(t.totalCost)} (${money(t.rawAvgCost, 4)}/sh${t.assignedPutPremium ? `, incl. ${money(t.assignedPutPremium)} assigned-put premium` : ""})` +
                (t.ibkrOpenCostBasis && t.ibkrOpenQty ? ` · broker statement: ${money(t.ibkrOpenCostBasis)} (${money(t.ibkrOpenCostBasis / t.ibkrOpenQty, 2)}/sh)` : "") +
                ` · adj. ${money(adj, 4)}/sh`
              : undefined
          }
        />
        <Stat label={`Net premium (${lotLabel})`} value={signed(w.netPremium)} cls={pnlClass(w.netPremium)} hint={`calls ${signed(w.callPremium)} · puts ${signed(w.putPremium)}`} />
        <Stat label={`Stock realized (${lotLabel})`} value={signed(w.stockRealizedPnl)} cls={pnlClass(w.stockRealizedPnl)} hint="sells + assignments, avg-cost method" />
      </div>

      <StartingPositionForm key={`${t.ticker}-${t.startingPosition?.shares ?? 0}`} t={t} onSave={onSaveStart} />

      <div>
        <div className="text-xs font-semibold text-gray-300 mb-1">
          Options written ({t.legs.length} contract line{t.legs.length === 1 ? "" : "s"})
          {lotActive && (
            <span className="font-normal text-gray-500"> · contracts sold before {t.lotStart!.slice(0, 10)} are dimmed and not counted (buybacks included), except the put that delivered the shares</span>
          )}
        </div>
        {t.legs.length === 0 ? (
          <div className="text-xs text-gray-500 italic">No option trades on {t.ticker} in the uploaded statements.</div>
        ) : (
          <div className="overflow-x-auto border border-gray-800 rounded">
            <table className="w-full">
              <thead className="bg-gray-900/60">
                <tr>
                  <Th>Contract</Th>
                  <Th>Opened</Th>
                  <Th>Closed</Th>
                  <Th right>Qty</Th>
                  <Th right title="Cash received on sell-to-open, net of commissions">Open credit</Th>
                  <Th right title="Cash paid to buy back, net of commissions">Close debit</Th>
                  <Th right>Net premium</Th>
                  <Th>Outcome</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {t.legs.map((l) => {
                  const counted = lotActive ? l.inLot : true;
                  const net = lotActive && !l.basisPut ? l.lotNetPremium : l.netPremium;
                  return (
                    <tr key={l.key} className={`hover:bg-gray-900/40 ${counted ? "" : "opacity-40"}`}>
                      <Td cls="text-gray-100">
                        {t.ticker} {l.expiration} ${l.strike} {l.right === "C" ? "Call" : "Put"}
                        {l.lotSeed && (
                          <span className="ml-1 text-[10px] uppercase text-emerald-400" title="This put's assignment delivered the current shares, so its premium counts toward their basis">
                            delivered lot
                          </span>
                        )}
                      </Td>
                      <Td cls="text-gray-400">
                        {l.premiumSource === "ibkr-realized" ? (
                          <span title="Sold before your earliest uploaded statement. Net premium is the broker's realized P&L on the buyback, which already nets the original credit.">
                            before history
                          </span>
                        ) : (
                          l.openedAt.slice(0, 10)
                        )}
                      </Td>
                      <Td cls="text-gray-400">{l.closedAt ? l.closedAt.slice(0, 10) : "—"}</Td>
                      <Td right cls="text-gray-300">{l.contracts}</Td>
                      <Td right cls="text-gray-300">{l.premiumSource === "ibkr-realized" ? "?" : money(l.openCredit)}</Td>
                      <Td right cls="text-gray-300">{l.closeDebit ? money(l.closeDebit) : "—"}</Td>
                      <Td right cls={`font-bold ${pnlClass(net)}`}>
                        {signed(net)}
                        {l.basisPut && lotActive && <span className="text-gray-500 font-normal" title="Assigned put: folded into the cost basis rather than the premium column"> → basis</span>}
                      </Td>
                      <td className="px-2 py-1.5">
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold ${OUTCOME_STYLE[l.outcome]}`}>
                          {l.outcome}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-300 mb-1">
          Stock fills ({t.stockFills.length})
          <span className="font-normal text-gray-500"> · untick a fill to leave it out of the position (e.g. shares you bought on top of an assignment)</span>
        </div>
        {t.stockFills.length === 0 ? (
          <div className="text-xs text-gray-500 italic">No stock fills on {t.ticker} in the uploaded statements.</div>
        ) : (
          <div className="overflow-x-auto border border-gray-800 rounded">
            <table className="w-full">
              <thead className="bg-gray-900/60">
                <tr>
                  <Th title="Ticked = counted in shares held and cost basis">Count</Th>
                  <Th>Date</Th>
                  <Th>Side</Th>
                  <Th right>Shares</Th>
                  <Th right>Price</Th>
                  <Th right>Net cash</Th>
                  <Th right title="Average-cost realized P&L on this sell">Realized</Th>
                  <Th right>Shares after</Th>
                  <Th right>Avg cost after</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {t.stockFills.map((f, i) => {
                  const startsLot = !f.excluded && t.lotStart === f.dateTime && f.quantity > 0;
                  return (
                    <tr key={i} className={`hover:bg-gray-900/40 ${startsLot ? "bg-emerald-500/5" : ""} ${f.excluded ? "opacity-40" : ""}`}>
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={!f.excluded}
                          onChange={(e) => onToggleFill(f.fillKey, !e.target.checked)}
                          title={f.excluded ? "Excluded — tick to count this fill again" : "Counted — untick to leave this fill out"}
                        />
                      </td>
                      <Td cls="text-gray-400">
                        {f.dateTime.slice(0, 16)}
                        {startsLot && <span className="ml-1 text-[10px] uppercase text-emerald-400" title="The current lot starts here">lot start</span>}
                      </Td>
                      <Td cls={f.quantity > 0 ? "text-emerald-300" : "text-red-300"}>
                        {f.quantity > 0 ? "Buy" : "Sell"}
                        {f.isAssignment ? " (assigned)" : ""}
                      </Td>
                      <Td right cls="text-gray-300">{Math.abs(f.quantity).toLocaleString()}</Td>
                      <Td right cls="text-gray-300">{money(f.price)}</Td>
                      <Td right cls={pnlClass(f.netCash)}>{signed(f.netCash)}</Td>
                      <Td right cls={`font-bold ${pnlClass(f.realizedPL)}`}>{f.quantity > 0 || f.excluded ? "—" : signed(f.realizedPL)}</Td>
                      <Td right cls="text-gray-300">{f.sharesAfter.toLocaleString()}</Td>
                      <Td right cls="text-gray-300">{f.sharesAfter > 0 ? money(f.avgCostAfter, 4) : "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface Loaded {
  statement: CcStatement;
  text: string; // kept so "remember on this device" can re-parse next visit
}

interface UploadNote {
  fileName: string;
  ok: boolean;
  message: string;
}

export default function Home() {
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [overrides, setOverrides] = useState<Record<string, CcStartingPosition>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<UploadNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [includePuts, setIncludePuts] = useState(true);
  const [sinceLot, setSinceLot] = useState(true);
  const [showFlat, setShowFlat] = useState(false);
  const [showNoOptions, setShowNoOptions] = useState(false);
  const [remember, setRemember] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: null, dir: "desc" });
  const [hydrated, setHydrated] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Restore anything the user chose to remember on this device. Runs after
  // mount (localStorage doesn't exist during prerender); deferred a tick so
  // the state updates aren't synchronous inside the effect.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const stored = loadStored();
      if (stored) {
        setRemember(true);
        setLoaded(
          stored.statements.map((s) => {
            const statement = parseStatementCsv(s.text, s.fileName);
            statement.uploadedAt = s.uploadedAt;
            return { statement, text: s.text };
          }),
        );
        setOverrides(stored.overrides);
        setExcluded(new Set(stored.excludedFills));
      }
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Persist (or wipe) whenever state changes and the user opted in.
  useEffect(() => {
    if (!hydrated) return;
    if (!remember) {
      clearStored();
      return;
    }
    const err = saveStored({
      statements: loaded.map((l) => ({ id: l.statement.id, fileName: l.statement.fileName, text: l.text, uploadedAt: l.statement.uploadedAt })),
      overrides,
      excludedFills: Array.from(excluded),
    });
    if (err) queueMicrotask(() => setError(`Couldn't remember on this device (${err}). Browser storage is probably full — try fewer statements.`));
  }, [hydrated, remember, loaded, overrides, excluded]);

  const report: CcReport | null = useMemo(
    () => (loaded.length ? buildReport(loaded.map((l) => l.statement), overrides, excluded) : null),
    [loaded, overrides, excluded],
  );

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".csv") || f.type === "text/csv");
      if (list.length === 0) {
        setError("Only .csv files are accepted: an IBKR Activity Statement or a Robinhood activity report.");
        return;
      }
      setError(null);
      const next = [...loaded];
      const out: UploadNote[] = [];
      for (const f of list) {
        try {
          const text = await f.text();
          if (!text.trim()) throw new Error("Empty file");
          const statement = parseStatementCsv(text, f.name);
          if (statement.trades.length === 0 && !statement.period) {
            throw new Error("Doesn't look like an IBKR Activity Statement or a Robinhood activity report");
          }
          if (next.some((l) => l.statement.id === statement.id)) {
            out.push({ fileName: f.name, ok: true, message: `already loaded (${statement.period ?? "unknown period"})` });
            continue;
          }
          next.push({ statement, text });
          out.push({ fileName: f.name, ok: true, message: `${statement.trades.length} stock/option fills · ${statement.period ?? "unknown period"}` });
        } catch (e) {
          out.push({ fileName: f.name, ok: false, message: e instanceof Error ? e.message : String(e) });
        }
      }
      setLoaded(next);
      setNotes(out);
      setIsDemo(false);
      if (fileRef.current) fileRef.current.value = "";
    },
    [loaded],
  );

  // One-click demo with the synthetic statements the tests use.
  const loadDemo = () => {
    setLoaded(DEMO_STATEMENTS.map((d) => ({ statement: parseStatementCsv(d.text, d.fileName), text: d.text })));
    setOverrides({});
    setExcluded(new Set());
    setNotes([]);
    setExpanded(new Set(["SNDK"]));
    setIsDemo(true);
  };

  const removeStatement = (id: string) => setLoaded((prev) => prev.filter((l) => l.statement.id !== id));
  const saveStart = (ticker: string, pos: CcStartingPosition | null) =>
    setOverrides((prev) => {
      const next = { ...prev };
      if (pos && pos.shares > 0) next[ticker] = pos;
      else delete next[ticker];
      return next;
    });
  const toggleFill = (fillKey: string, isExcluded: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (isExcluded) next.add(fillKey);
      else next.delete(fillKey);
      return next;
    });
  const toggleRow = (tk: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tk)) next.delete(tk);
      else next.add(tk);
      return next;
    });
  const clearAll = () => {
    setLoaded([]);
    setOverrides({});
    setExcluded(new Set());
    setNotes([]);
    setExpanded(new Set());
    setIsDemo(false);
  };

  const isActive = (t: CcTickerSummary) => t.sharesHeld > 0 || t.openCalls > 0 || t.openPuts > 0;
  const hasOptions = (t: CcTickerSummary) => t.legs.length > 0;
  const flatCount = (report?.tickers ?? []).filter((t) => !isActive(t) && (showNoOptions || hasOptions(t))).length;
  const noOptionsCount = (report?.tickers ?? []).filter((t) => !hasOptions(t) && (showFlat || isActive(t))).length;
  const totals = sinceLot ? report?.lotTotals : report?.totals;
  const totalPremium = includePuts ? totals?.netPremium : totals?.callPremium;

  // One derived row per visible stock, then sorted. Everything downstream —
  // the table, the mobile cards and the CSV — reads these, so they can't drift.
  const rows: Row[] = useMemo(() => {
    const visible = (report?.tickers ?? []).filter(
      (t) => (showFlat || isActive(t)) && (showNoOptions || hasOptions(t)),
    );
    const built = visible.map((t) => {
      const w = sinceLot ? t.lot : t.lifetime;
      const prem = includePuts ? w.netPremium : w.callPremium;
      return {
        t,
        w,
        prem,
        adj: includePuts ? w.adjustedAvgCost : w.adjustedAvgCostCallsOnly,
        be: includePuts ? w.breakEven : w.breakEvenCallsOnly,
        premPct: t.totalCost > 0 ? (prem / t.totalCost) * 100 : null,
        adjBasis: t.sharesHeld > 0 ? t.totalCost - prem : null,
      };
    });
    if (!sort.key) return built;
    const key = sort.key;
    // Sort keys that read as text; everything else is compared as a number,
    // with blanks pushed to the bottom whichever way the column is pointing.
    const textOf = (r: Row) => (key === "ticker" ? r.t.ticker : key === "lot" ? (r.t.lotStart ?? "") : null);
    const numOf = (r: Row): number | null => {
      switch (key) {
        case "shares": return r.t.sharesHeld;
        case "cost": return r.t.rawAvgCost;
        case "call": return r.w.callPremium;
        case "put": return r.w.putPremium;
        case "premPct": return r.premPct;
        case "basis": return r.t.sharesHeld > 0 ? r.t.totalCost : null;
        case "adjBasis": return r.adjBasis;
        case "adj": return r.adj;
        case "be": return r.be;
        case "open": return r.t.openCalls + r.t.openPuts;
        case "written": return r.w.callsWritten + r.w.putsWritten;
        default: return null;
      }
    };
    const flip = sort.dir === "asc" ? 1 : -1;
    return [...built].sort((a, b) => {
      const ta = textOf(a);
      if (ta !== null) return ta.localeCompare(textOf(b)!) * flip;
      const na = numOf(a);
      const nb = numOf(b);
      if (na == null && nb == null) return 0;
      if (na == null) return 1;
      if (nb == null) return -1;
      return (na - nb) * flip;
    });
  }, [report, showFlat, showNoOptions, sinceLot, includePuts, sort]);

  // First click on a column sorts biggest-first (descending), which is what
  // you want on every money column; the name column starts A→Z.
  const toggleSort = (k: SortKey) =>
    setSort((prev) => (prev.key === k ? { key: k, dir: prev.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "ticker" ? "asc" : "desc" }));

  // Download what's on screen. Same columns, same order, same toggles — so a
  // spreadsheet built from this matches what the page showed.
  const exportCsv = () => {
    const head = [
      "Stock", "Shares", "Lot start", "Cost per share", "Call premium", "Put premium",
      "Premium % of basis", "Cost basis", "Adjusted basis", "Adjusted cost per share",
      "Break-even", "Open calls", "Open puts", "Calls written", "Puts written",
    ];
    const num = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "" : String(Math.round(n * 10000) / 10000));
    const body = rows.map((r) => [
      r.t.ticker,
      String(r.t.sharesHeld),
      r.t.sharesHeld > 0 ? (r.t.lotStart ? r.t.lotStart.slice(0, 10) : "before history") : "",
      num(r.t.rawAvgCost),
      num(r.w.callPremium),
      num(r.w.putPremium),
      r.premPct == null ? "" : r.premPct.toFixed(2),
      r.t.sharesHeld > 0 ? num(r.t.totalCost) : "",
      num(r.adjBasis),
      num(r.adj),
      num(r.be),
      String(r.t.openCalls),
      String(r.t.openPuts),
      String(r.w.callsWritten),
      String(r.w.putsWritten),
    ]);
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [head, ...body].map((line) => line.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `optionbasis-${sinceLot ? "current-lots" : "all-history"}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <SiteHeader
        current="home"
        actions={
          <button
            onClick={loadDemo}
            className="text-xs px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold whitespace-nowrap"
            title="Load a set of made-up statements so you can see what the tool does"
          >
            Try the demo
          </button>
        }
      />

      {/* Hero. Collapses to a single line once a statement is loaded so the
          numbers get the screen. */}
      <div className="bg-gray-900 border-b border-gray-800 px-3 sm:px-6 py-4 sm:py-6">
        <h1 className="text-xl sm:text-3xl font-extrabold text-gray-100 tracking-tight max-w-3xl">
          What your shares <span className="text-emerald-400">really</span> cost, after option premium
        </h1>
        {!report ? (
          <>
            <p className="text-sm text-gray-400 mt-2 max-w-2xl leading-relaxed">
              Drop in an Interactive Brokers or Robinhood activity statement. For every stock you hold, OptionBasis nets
              the calls you sold, the buybacks, the rolls and the put that got you assigned against the shares — and
              tells you the adjusted cost per share and the price where you break even.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
              <span className="text-emerald-400">✓ Free, no account</span>
              <span className="text-emerald-400">✓ Nothing is uploaded — it runs in your browser</span>
              <span className="text-emerald-400">✓ Refresh and it&apos;s gone</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-500 mt-1.5">
            Parsed in your browser. Nothing was uploaded.
          </p>
        )}
      </div>

      {/* Upload */}
      <div className="px-3 sm:px-6 py-4 border-b border-gray-800 space-y-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragOver ? "border-emerald-500 bg-emerald-500/10" : "border-gray-700 bg-gray-900/40 hover:border-gray-500"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) upload(e.target.files); }}
          />
          <div className="text-sm font-semibold text-gray-200">Drop statement CSVs here, or tap to choose</div>
          {isDemo && (
            <div className="text-xs text-emerald-300 mt-1">Showing demo data — drop your own statement to replace it.</div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            Interactive Brokers: Client Portal → Performance &amp; Reports → Statements → Activity → CSV.
            Robinhood: Account → Reports and statements → Activity reports → CSV. Overlapping statements are de-duplicated.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
          <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Keeps the statements in this browser's local storage so you don't have to re-upload. Still never leaves your device.">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember on this device
          </label>
          {loaded.length > 0 && (
            <button onClick={clearAll} className="text-gray-500 hover:text-red-400">Clear everything</button>
          )}
        </div>

        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1.5 flex justify-between gap-2">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}
        {notes.length > 0 && (
          <div className="text-xs bg-gray-900/60 border border-gray-800 rounded px-2 py-1.5 space-y-0.5">
            {notes.map((u, i) => (
              <div key={i} className={u.ok ? "text-emerald-300" : "text-red-300"}>
                {u.fileName}: {u.message}
              </div>
            ))}
            <button onClick={() => setNotes([])} className="text-gray-500 hover:text-gray-300">dismiss</button>
          </div>
        )}

        {report && report.statements.length > 0 && (
          <div className="text-xs">
            <div className="text-gray-500 uppercase tracking-wider text-[10px] mb-1">
              Statements loaded ({report.statements.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {report.statements.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded px-2 py-1 text-gray-300"
                  title={s.fileName}
                >
                  <span className="text-gray-500 uppercase text-[10px]">{s.broker === "robinhood" ? "RH" : "IBKR"}</span>
                  <span className="font-mono">{s.periodStart && s.periodEnd ? `${s.periodStart} → ${s.periodEnd}` : s.period ?? s.fileName}</span>
                  {s.accountId && <span className="text-gray-500">{s.accountId}</span>}
                  <span className="text-gray-500">{s.tradeCount} fills</span>
                  <button onClick={() => removeStatement(s.id)} className="text-gray-500 hover:text-red-400" title="Remove this statement">✕</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <ReferralBanner />

      {/* Summary */}
      {report && report.tickers.length > 0 && totals && (
        <div className="px-3 sm:px-6 py-4 border-b border-gray-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Call premium" value={signed(totals.callPremium)} cls={pnlClass(totals.callPremium)} hint={sinceLot ? "stocks you hold, current lots · net of buybacks + commissions" : "all history, every name · net of buybacks + commissions"} />
            <Stat label="Put premium" value={signed(totals.putPremium)} cls={pnlClass(totals.putPremium)} hint="net of buybacks + commissions" />
            <Stat label="Stock realized" value={signed(totals.stockRealizedPnl)} cls={pnlClass(totals.stockRealizedPnl)} hint="sells + assignments" />
            <Stat
              label="Total"
              value={signed((totalPremium ?? 0) + totals.stockRealizedPnl)}
              cls={pnlClass((totalPremium ?? 0) + totals.stockRealizedPnl)}
              hint={includePuts ? "calls + puts + stock" : "calls + stock"}
            />
          </div>
        </div>
      )}

      {/* Per-ticker table */}
      <div className="px-3 sm:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-gray-200">By stock {report ? `(${rows.length})` : ""}</div>
            {rows.length > 0 && (
              <button
                onClick={exportCsv}
                className="text-[11px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-semibold"
                title="Download the table exactly as shown — same columns, same toggles. Built in your browser."
              >
                ↓ CSV
              </button>
            )}
          </div>
          {report && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Only count contracts sold since the fill that started the current lot of shares (e.g. since the put assignment that delivered them). Off = everything in the uploaded statements.">
              <input type="checkbox" checked={sinceLot} onChange={(e) => setSinceLot(e.target.checked)} />
              Only since current shares were acquired
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={includePuts} onChange={(e) => setIncludePuts(e.target.checked)} />
              Count put premium toward basis
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={showFlat} onChange={(e) => setShowFlat(e.target.checked)} />
              Show closed-out names{flatCount > 0 ? ` (${flatCount})` : ""}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Stocks in the statements with no option trades against them (index funds, dividend reinvestments, …)">
              <input type="checkbox" checked={showNoOptions} onChange={(e) => setShowNoOptions(e.target.checked)} />
              Show stocks with no options{noOptionsCount > 0 ? ` (${noOptionsCount})` : ""}
            </label>
          </div>
          )}
        </div>

        {!report ? (
          <div className="text-sm text-gray-500 italic py-10 text-center">
            Nothing loaded yet. Drop an activity statement above to see your numbers.
          </div>
        ) : report.tickers.length === 0 ? (
          <div className="text-sm text-gray-500 italic py-6 text-center">No stock or option trades found in the loaded statements.</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-500 italic py-6 text-center">
            Nothing currently held. Tick &ldquo;Show closed-out names&rdquo; to see past campaigns.
          </div>
        ) : (
          <>
            {/* Phone layout: one card per stock. Thirteen columns don't fit on
                a 390px screen, and a horizontally scrolled table is worse than
                no table. */}
            <div className="sm:hidden space-y-2">
              {rows.map(({ t, w, prem, adj, be, premPct, adjBasis }) => {
                const isOpen = expanded.has(t.ticker);
                return (
                  <div key={t.ticker} className="border border-gray-800 rounded-lg bg-gray-900/40 overflow-hidden">
                    <button
                      onClick={() => toggleRow(t.ticker)}
                      aria-expanded={isOpen}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-900/60"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="text-gray-500">{isOpen ? "▾" : "▸"}</span>
                          <span className="font-bold text-gray-100">{t.ticker}</span>
                          {t.warnings.length > 0 && <span className="text-yellow-400" title={t.warnings.join("\n")}>⚠</span>}
                          <span className="text-xs text-gray-500 truncate">
                            {t.sharesHeld.toLocaleString()} sh
                            {t.openCalls > 0 ? ` · ${t.openCalls}C open` : ""}
                            {t.openPuts > 0 ? ` · ${t.openPuts}P open` : ""}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] uppercase text-gray-500 leading-none">Adj. cost / sh</div>
                          <div className="font-mono font-bold text-emerald-300 text-base leading-tight">
                            {t.sharesHeld > 0 ? money(adj) : <span className="text-sm text-gray-500">flat {signed(w.totalPnlIfFlat)}</span>}
                          </div>
                        </div>
                      </div>
                      <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 mt-2.5 text-[11px]">
                        <div>
                          <dt className="text-gray-500 uppercase text-[9px]">Cost / sh</dt>
                          <dd className="font-mono text-gray-300">{money(t.rawAvgCost)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 uppercase text-[9px]">Call prem</dt>
                          <dd className={`font-mono ${pnlClass(w.callPremium)}`}>{signed(w.callPremium)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 uppercase text-[9px]">Put prem</dt>
                          <dd className={`font-mono ${w.putPremium === 0 ? "text-gray-600" : pnlClass(w.putPremium)}`}>{signed(w.putPremium)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 uppercase text-[9px]">Adj. basis</dt>
                          <dd className="font-mono text-gray-200">{money(adjBasis)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 uppercase text-[9px]">Break-even</dt>
                          <dd className="font-mono text-gray-200">{money(be)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 uppercase text-[9px]">Prem %</dt>
                          <dd className="font-mono text-gray-300">{premPct == null ? "—" : `${premPct.toFixed(1)}%`}</dd>
                        </div>
                      </dl>
                      <div className="text-[10px] text-gray-600 mt-1.5">
                        {w.callsWritten} call{w.callsWritten === 1 ? "" : "s"} written
                        {w.putsWritten > 0 ? ` · ${w.putsWritten} puts` : ""}
                        {t.sharesHeld > 0 ? ` · since ${t.lotStart ? t.lotStart.slice(0, 10) : "before history"}` : ""}
                      </div>
                    </button>
                    {isOpen && (
                      <TickerDetail t={t} w={w} prem={prem} adj={adj} sinceLot={sinceLot} onSaveStart={saveStart} onToggleFill={toggleFill} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tablet and up: the full table. The Stock column is pinned so
                you keep the ticker in view while scrolling right. */}
            <div className="hidden sm:block overflow-x-auto border border-gray-800 rounded">
              <table className="w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <SortTh k="ticker" sort={sort} onSort={toggleSort} sticky>Stock</SortTh>
                    <SortTh k="shares" sort={sort} onSort={toggleSort} right>Shares</SortTh>
                    <SortTh k="lot" sort={sort} onSort={toggleSort} title="When the current lot of shares started (the buy or assignment that took the position from 0). 'before history' = held since before the uploaded statements.">Since</SortTh>
                    <SortTh k="cost" sort={sort} onSort={toggleSort} right title="Cost per share of the shares held: what you paid, net of the premium from the put that delivered them (if any)">Cost / sh</SortTh>
                    <SortTh k="call" sort={sort} onSort={toggleSort} right title="Net premium from calls (opens − buybacks − commissions)">Call prem</SortTh>
                    <SortTh k="put" sort={sort} onSort={toggleSort} right title="Net premium from puts">Put prem</SortTh>
                    <SortTh k="premPct" sort={sort} onSort={toggleSort} right title="Premium collected as a % of the current cost basis">Prem %</SortTh>
                    <SortTh k="basis" sort={sort} onSort={toggleSort} right title="Total cost of the shares held, net of the premium from the put that delivered them (average-cost method)">Cost basis</SortTh>
                    <SortTh k="adjBasis" sort={sort} onSort={toggleSort} right title="Cost basis − premium collected: what the shares have really cost you">Adj. basis</SortTh>
                    <SortTh k="adj" sort={sort} onSort={toggleSort} right title="(cost basis − premium) ÷ shares held: your adjusted cost per share">Adj. cost / sh</SortTh>
                    <SortTh k="be" sort={sort} onSort={toggleSort} right title="(cost basis − premium − realized stock P&L) ÷ shares. Sell everything here and the whole campaign nets to zero.">Break-even</SortTh>
                    <SortTh k="open" sort={sort} onSort={toggleSort} right title="Contracts currently short">Open</SortTh>
                    <SortTh k="written" sort={sort} onSort={toggleSort}>Calls written</SortTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {rows.map(({ t, w, prem, adj, be, premPct, adjBasis }) => {
                    const isOpen = expanded.has(t.ticker);
                    return (
                      <Fragment key={t.ticker}>
                        <tr onClick={() => toggleRow(t.ticker)} className={`group cursor-pointer hover:bg-gray-900/40 ${isOpen ? "bg-gray-900/30" : ""}`}>
                          {/* Pinned so the ticker stays put while the row
                              scrolls. It needs an opaque background, so the
                              row's translucent hover/open tints are baked in
                              here as the colours they composite to. */}
                          <td className={`sticky left-0 z-10 px-2 py-1.5 font-mono text-xs whitespace-nowrap text-gray-100 font-bold group-hover:bg-[#0a1420] ${isOpen ? "bg-[#07101a]" : "bg-gray-950"}`}>
                            <span className="text-gray-500 mr-1">{isOpen ? "▾" : "▸"}</span>
                            {t.ticker}
                            {t.warnings.length > 0 && <span className="ml-1 text-yellow-400" title={t.warnings.join("\n")}>⚠</span>}
                          </td>
                          <Td right cls="text-gray-300">{t.sharesHeld.toLocaleString()}</Td>
                          <Td cls="text-gray-500">{t.sharesHeld > 0 ? (t.lotStart ? t.lotStart.slice(0, 10) : "before history") : "—"}</Td>
                          <Td right cls="text-gray-300">{money(t.rawAvgCost)}</Td>
                          <Td right cls={pnlClass(w.callPremium)}>{signed(w.callPremium)}</Td>
                          <Td right cls={w.putPremium === 0 ? "text-gray-600" : pnlClass(w.putPremium)}>{signed(w.putPremium)}</Td>
                          <Td right cls="text-gray-300">{premPct == null ? "—" : `${premPct.toFixed(1)}%`}</Td>
                          <Td right cls="text-gray-300">
                            {t.sharesHeld > 0 ? (
                              <span title={t.assignedPutPremium ? `strike cost ${money(t.totalCost + t.assignedPutPremium)} − ${money(t.assignedPutPremium)} assigned-put premium` : undefined}>
                                {money(t.totalCost)}{t.assignedPutPremium ? <span className="text-emerald-500">*</span> : null}
                              </span>
                            ) : "—"}
                          </Td>
                          <Td right cls="text-gray-200">{money(adjBasis)}</Td>
                          <Td right cls="text-emerald-300 font-bold">
                            {t.sharesHeld > 0 ? money(adj) : <span className="text-gray-500" title="Position closed out">flat {signed(w.totalPnlIfFlat)}</span>}
                          </Td>
                          <Td right cls="text-gray-200">{money(be)}</Td>
                          <Td right cls="text-gray-300">
                            {t.openCalls > 0 ? `${t.openCalls}C` : ""}
                            {t.openCalls > 0 && t.openPuts > 0 ? " " : ""}
                            {t.openPuts > 0 ? `${t.openPuts}P` : ""}
                            {t.openCalls === 0 && t.openPuts === 0 ? "—" : ""}
                          </Td>
                          <Td cls="text-gray-400">
                            {w.callsWritten} ct{w.putsWritten > 0 ? ` · ${w.putsWritten} puts` : ""}
                          </Td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={13} className="p-0">
                              <TickerDetail t={t} w={w} prem={prem} adj={adj} sinceLot={sinceLot} onSaveStart={saveStart} onToggleFill={toggleFill} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {report && (
        <div className="text-[11px] text-gray-500 mt-3 space-y-1">
          <div>
            <span className="text-gray-400">Only since current shares were acquired</span>{" "}starts the clock at the buy or
            assignment that took the position from zero. Contracts sold before that (e.g. calls written on shares you no
            longer hold) belong to the previous campaign and are left out, buybacks included. The put whose assignment
            delivered the shares is different: its premium is netted straight into the cost basis (marked *), so the
            basis is strike × shares − that credit, and the calls written since come off that.{" "}
            <Link href="/guides/put-assignment-cost-basis" className="text-gray-400 underline hover:text-gray-200">Why assigned puts work this way</Link>.
          </div>
          <div>
            <span className="text-gray-400">Adj. basis</span> = cost basis of shares held − net option premium;{" "}
            <span className="text-gray-400">Adj. cost / sh</span> = that ÷ shares held.
            Premium is net of buybacks and commissions; expired contracts keep the full credit. A roll counts
            the buyback against the old contract and the new credit on the new one.{" "}
            <Link href="/guides/rolling-covered-calls" className="text-gray-400 underline hover:text-gray-200">How rolls are tracked</Link>.
          </div>
          <div>
            <span className="text-gray-400">Break-even</span>{" "}also nets realized stock P&amp;L from shares you sold or had called away,
            so it&apos;s the price where the whole campaign on that name comes out even.
          </div>
          <div>
            Share cost basis uses the average-cost method, which is not what your broker reports for taxes. This is a
            trading tool, not tax or investment advice —{" "}
            <Link href="/guides/covered-call-cost-basis" className="text-gray-400 underline hover:text-gray-200">the full method is written up here</Link>.
          </div>
        </div>
        )}
      </div>

      {!report && (
        <section className="px-3 sm:px-6 py-4 border-t border-gray-800">
          <div className="text-sm font-semibold text-gray-200 mb-2">How it works</div>
          <ol className="grid gap-2 sm:grid-cols-3 text-xs text-gray-400">
            <li className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
              <div className="text-emerald-400 font-bold mb-1">1 · Export</div>
              IBKR: Performance &amp; Reports → Statements → Activity → CSV. Robinhood: Reports and statements → Activity
              reports → CSV. One month or a whole year; overlapping periods are de-duplicated.
            </li>
            <li className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
              <div className="text-emerald-400 font-bold mb-1">2 · Drop it here</div>
              The file is parsed in your browser. Assignments, rolls, buybacks and expirations are matched up per
              stock automatically.
            </li>
            <li className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
              <div className="text-emerald-400 font-bold mb-1">3 · Read your real basis</div>
              Strike minus the put that got you assigned, minus every call since: what the shares actually cost you,
              and the price where you break even.
            </li>
          </ol>
        </section>
      )}

      {!report && (
        <section className="px-3 sm:px-6 py-4 border-t border-gray-800">
          <FaqSchema />
          <h2 className="text-sm font-semibold text-gray-200 mb-2">Common questions</h2>
          <div className="space-y-2 max-w-3xl">
            {FAQ.map((f) => (
              <details key={f.q} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                <summary className="text-sm font-semibold text-gray-200 cursor-pointer">{f.q}</summary>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <AdSlot slot="below-results" />
      {report && <DonatePanel />}
      <Referrals />
      {!report && <DonatePanel />}
      <SiteFooter />
    </div>
  );
}
