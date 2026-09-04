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
import { Referrals } from "@/components/Referrals";
import { AdSlot } from "@/components/AdSlot";

// TrueBasis — upload a brokerage activity statement, see per stock how much
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
      <div className="text-gray-300 font-semibold mb-1">Starting position (before your earliest statement)</div>
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
        {t.startingPosition && (
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
              ? `cost basis ${money(t.totalCost)} (${money(t.rawAvgCost, 4)}/sh${t.seedPutPremium ? `, incl. ${money(t.seedPutPremium)} put premium` : ""})` +
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
                  const net = lotActive && !l.lotSeed ? l.lotNetPremium : l.netPremium;
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
                        {l.lotSeed && lotActive && <span className="text-gray-500 font-normal" title="Folded into the cost basis rather than the premium column"> → basis</span>}
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
  const [remember, setRemember] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
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
        setError("Only .csv files are accepted. In IBKR: Performance & Reports → Statements → Activity → CSV.");
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
            throw new Error("Doesn't look like an IBKR Activity Statement CSV (no Trades / Statement sections)");
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
  const tickers = (report?.tickers ?? []).filter((t) => showFlat || isActive(t));
  const flatCount = (report?.tickers ?? []).filter((t) => !isActive(t)).length;
  const windowOf = (t: CcTickerSummary): CcPremiumWindow => (sinceLot ? t.lot : t.lifetime);
  const totals = sinceLot ? report?.lotTotals : report?.totals;
  const totalPremium = includePuts ? totals?.netPremium : totals?.callPremium;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-3 sm:px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-emerald-400">TrueBasis</h1>
            <p className="text-sm text-gray-400 mt-1 max-w-3xl">
              Drop in a brokerage activity statement. For each stock you own, see how much option premium you&apos;ve
              collected against it and what the shares <span className="text-gray-200">really</span> cost you after that premium.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Runs entirely in your browser — the statement is never uploaded anywhere. Refresh and it&apos;s gone.
            </p>
          </div>
          <button
            onClick={loadDemo}
            className="shrink-0 text-xs px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold"
            title="Load a set of made-up statements so you can see what the tool does"
          >
            Try the demo
          </button>
        </div>
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
            Interactive Brokers for now: Client Portal → Performance &amp; Reports → Statements → Activity → CSV.
            Overlapping statements are de-duplicated. More brokers coming.
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

      {/* Summary */}
      {report && report.tickers.length > 0 && totals && (
        <div className="px-3 sm:px-6 py-4 border-b border-gray-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Call premium" value={signed(totals.callPremium)} cls={pnlClass(totals.callPremium)} hint={sinceLot ? "current lots · net of buybacks + commissions" : "all history · net of buybacks + commissions"} />
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
          <div className="text-sm font-semibold text-gray-200">By stock {report ? `(${tickers.length})` : ""}</div>
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
          </div>
        </div>

        {!report ? (
          <div className="text-sm text-gray-500 italic py-10 text-center">
            Nothing loaded yet. Drop an activity statement above to see your numbers.
          </div>
        ) : report.tickers.length === 0 ? (
          <div className="text-sm text-gray-500 italic py-6 text-center">No stock or option trades found in the loaded statements.</div>
        ) : tickers.length === 0 ? (
          <div className="text-sm text-gray-500 italic py-6 text-center">
            Nothing currently held. Tick &ldquo;Show closed-out names&rdquo; to see past campaigns.
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-800 rounded">
            <table className="w-full">
              <thead className="bg-gray-900/60">
                <tr>
                  <Th>Stock</Th>
                  <Th right>Shares</Th>
                  <Th title="When the current lot of shares started (the buy or assignment that took the position from 0). 'before history' = held since before the uploaded statements.">Since</Th>
                  <Th right title="Cost per share of the shares held: what you paid, net of the premium from the put that delivered them (if any)">Cost / sh</Th>
                  <Th right title="Net premium from calls (opens − buybacks − commissions)">Call prem</Th>
                  <Th right title="Net premium from puts">Put prem</Th>
                  <Th right title="Premium collected as a % of the current cost basis">Prem %</Th>
                  <Th right title="Total cost of the shares held, net of the premium from the put that delivered them (average-cost method)">Cost basis</Th>
                  <Th right title="Cost basis − premium collected: what the shares have really cost you">Adj. basis</Th>
                  <Th right title="(cost basis − premium) ÷ shares held: your adjusted cost per share">Adj. cost / sh</Th>
                  <Th right title="(cost basis − premium − realized stock P&L) ÷ shares. Sell everything here and the whole campaign nets to zero.">Break-even</Th>
                  <Th right title="Contracts currently short">Open</Th>
                  <Th>Calls written</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {tickers.map((t) => {
                  const isOpen = expanded.has(t.ticker);
                  const w = windowOf(t);
                  const prem = includePuts ? w.netPremium : w.callPremium;
                  const adj = includePuts ? w.adjustedAvgCost : w.adjustedAvgCostCallsOnly;
                  const be = includePuts ? w.breakEven : w.breakEvenCallsOnly;
                  const premPct = t.totalCost > 0 ? (prem / t.totalCost) * 100 : null;
                  return (
                    <Fragment key={t.ticker}>
                      <tr onClick={() => toggleRow(t.ticker)} className={`cursor-pointer hover:bg-gray-900/40 ${isOpen ? "bg-gray-900/30" : ""}`}>
                        <Td cls="text-gray-100 font-bold">
                          <span className="text-gray-500 mr-1">{isOpen ? "▾" : "▸"}</span>
                          {t.ticker}
                          {t.warnings.length > 0 && <span className="ml-1 text-yellow-400" title={t.warnings.join("\n")}>⚠</span>}
                        </Td>
                        <Td right cls="text-gray-300">{t.sharesHeld.toLocaleString()}</Td>
                        <Td cls="text-gray-500">{t.sharesHeld > 0 ? (t.lotStart ? t.lotStart.slice(0, 10) : "before history") : "—"}</Td>
                        <Td right cls="text-gray-300">{money(t.rawAvgCost)}</Td>
                        <Td right cls={pnlClass(w.callPremium)}>{signed(w.callPremium)}</Td>
                        <Td right cls={w.putPremium === 0 ? "text-gray-600" : pnlClass(w.putPremium)}>{signed(w.putPremium)}</Td>
                        <Td right cls="text-gray-300">{premPct == null ? "—" : `${premPct.toFixed(1)}%`}</Td>
                        <Td right cls="text-gray-300">
                          {t.sharesHeld > 0 ? (
                            <span title={t.seedPutPremium ? `strike cost ${money(t.totalCost + t.seedPutPremium)} − ${money(t.seedPutPremium)} put premium` : undefined}>
                              {money(t.totalCost)}{t.seedPutPremium ? <span className="text-emerald-500">*</span> : null}
                            </span>
                          ) : "—"}
                        </Td>
                        <Td right cls="text-gray-200">{t.sharesHeld > 0 ? money(t.totalCost - prem) : "—"}</Td>
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
        )}

        {report && (
        <div className="text-[11px] text-gray-500 mt-3 space-y-1">
          <div>
            <span className="text-gray-400">Only since current shares were acquired</span>{" "}starts the clock at the buy or
            assignment that took the position from zero. Contracts sold before that (e.g. calls written on shares you no
            longer hold) belong to the previous campaign and are left out, buybacks included. The put whose assignment
            delivered the shares is different: its premium is netted straight into the cost basis (marked *), so the
            basis is strike × shares − that credit, and the calls written since come off that.
          </div>
          <div>
            <span className="text-gray-400">Adj. basis</span> = cost basis of shares held − net option premium;{" "}
            <span className="text-gray-400">Adj. cost / sh</span> = that ÷ shares held.
            Premium is net of buybacks and commissions; expired contracts keep the full credit. A roll counts
            the buyback against the old contract and the new credit on the new one.
          </div>
          <div>
            <span className="text-gray-400">Break-even</span>{" "}also nets realized stock P&amp;L from shares you sold or had called away,
            so it&apos;s the price where the whole campaign on that name comes out even.
          </div>
          <div>
            Share cost basis uses the average-cost method, which is not what your broker reports for taxes. This is a
            trading tool, not tax or investment advice.
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
              In IBKR: Performance &amp; Reports → Statements → Activity → CSV. One month or a whole year; overlapping
              periods are de-duplicated.
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

      <AdSlot slot="below-results" />
      <Referrals />

      <footer className="px-3 sm:px-6 py-4 border-t border-gray-800 text-[11px] text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
        <span>© {new Date().getFullYear()} TrueBasis</span>
        <Link href="/privacy" className="hover:text-gray-300">Privacy</Link>
        <Link href="/disclaimer" className="hover:text-gray-300">Disclaimer</Link>
        <span>Not investment or tax advice.</span>
      </footer>
    </div>
  );
}
