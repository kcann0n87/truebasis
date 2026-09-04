import fs from "fs";
import assert from "assert";
import path from "path";
import { parseStatementCsv, buildReport } from "../src/lib/covered-calls.ts";

const fx = (n: string) => fs.readFileSync(path.join(import.meta.dirname, "fixtures", n), "utf-8");

const june = parseStatementCsv(fx("june.csv"), "june.csv");
const july = parseStatementCsv(fx("july.csv"), "july.csv");
assert.equal(june.periodStart, "2026-06-01");
assert.equal(june.periodEnd, "2026-06-30");
assert.equal(june.accountId, "U1234567");
assert.equal(june.trades.length, 7);
assert.equal(june.priorStockQty.TSLA, 100);
assert.equal(june.openStock.NVDA.quantity, 200);

const r = buildReport([july, june]);
const nvda = r.tickers.find((t) => t.ticker === "NVDA")!;
const tsla = r.tickers.find((t) => t.ticker === "TSLA")!;

assert.equal(nvda.sharesHeld, 100);
assert.equal(nvda.totalCost, 14000.5);
assert.equal(nvda.rawAvgCost, 140.005);
assert.equal(nvda.lifetime.callPremium, 2394.15);
assert.equal(nvda.lifetime.putPremium, 0);
assert.equal(nvda.lifetime.stockRealizedPnl, 499.5);
assert.equal(nvda.lifetime.adjustedAvgCost, 116.0635);
assert.equal(nvda.lifetime.breakEven, 111.0685);
assert.equal(nvda.lifetime.callsWritten, 7);
assert.equal(nvda.openCalls, 2);
assert.equal(nvda.legs.length, 4);
const outcomes = Object.fromEntries(nvda.legs.map((l) => [l.key, l.outcome]));
assert.equal(outcomes["NVDA|C|150|2026-06-19"], "expired");
assert.equal(outcomes["NVDA|C|155|2026-07-17"], "closed");
assert.equal(outcomes["NVDA|C|145|2026-07-24"], "assigned");
assert.equal(outcomes["NVDA|C|160|2026-08-21"], "open");
assert.equal(nvda.warnings.length, 0, nvda.warnings.join("\n"));
assert.equal(nvda.ibkrOpenQty, 100);
// TSLA: shares held before the earliest statement, no stock fills uploaded.
assert.equal(tsla.sharesHeld, 0);
assert.equal(tsla.lifetime.callPremium, 209.35);
assert.ok(tsla.warnings.some((w) => w.includes("already held")), tsla.warnings.join("\n"));
// With an override the history is complete
const r2 = buildReport([june, july], { TSLA: { shares: 100, avgCost: 250 } });
const tsla2 = r2.tickers.find((t) => t.ticker === "TSLA")!;
assert.equal(tsla2.sharesHeld, 100);
assert.equal(tsla2.lifetime.adjustedAvgCost, 247.9065);
assert.equal(tsla2.warnings.length, 0, tsla2.warnings.join("\n"));
assert.equal(r.totals.callPremium, 2603.5);
console.log("ALL PASS");

// ── August alone: history starts AFTER the shares + the Aug call were opened ──
const aug = parseStatementCsv(fx("aug.csv"), "aug.csv");
const r3 = buildReport([aug]);
const n3 = r3.tickers.find((t) => t.ticker === "NVDA")!;
// The sell of 100 shares with nothing on the books uses IBKR's realized, not the full proceeds.
assert.equal(n3.lifetime.stockRealizedPnl, 1198.5);
assert.ok(n3.warnings.some((w) => w.includes("IBKR's own realized")), n3.warnings.join("\n"));
// The buyback of the pre-history 160C is a roll leg: IBKR's realized (+797.4), not a −201.3 "loss".
const roll = n3.legs.find((l) => l.strike === 160)!;
assert.equal(roll.premiumSource, "ibkr-realized");
assert.equal(roll.netPremium, 797.4);
assert.equal(roll.outcome, "closed");
const fresh = n3.legs.find((l) => l.strike === 165)!;
assert.equal(fresh.premiumSource, "fills");
assert.equal(fresh.netPremium, 598.7);
assert.equal(n3.lifetime.callPremium, 1396.1);
// With full history, the same Aug statement must NOT double count: 160C uses fills.
const r4 = buildReport([june, july, aug]);
const n4 = r4.tickers.find((t) => t.ticker === "NVDA")!;
const roll4 = n4.legs.find((l) => l.strike === 160)!;
assert.equal(roll4.premiumSource, "fills");
assert.equal(roll4.netPremium, 797.4);
assert.equal(n4.lifetime.callPremium, 2394.15 - 201.3 + 598.7);
assert.equal(n4.lifetime.stockRealizedPnl, 499.5 + (15199 - 14000.5));
console.log("ROLL/PRE-HISTORY PASS");

// NVDA's lot started at the June 2 buy inside history → lot window == lifetime
assert.equal(nvda.lotStart, "2026-06-02 09:35:12");
assert.deepEqual(nvda.lot, nvda.lifetime);
assert.equal(tsla2.lotStart, undefined); // override → held before history

// ── SNDK: assigned 7/8; only premium after that counts toward the current lot ──
const sndk = buildReport([parseStatementCsv(fx("sndk.csv"), "sndk.csv")]).tickers[0];
assert.equal(sndk.ticker, "SNDK");
assert.equal(sndk.sharesHeld, 100);
assert.equal(sndk.lotStart, "2026-07-08 16:20:00");
// Lifetime: June call 4999 + put 2999 + (3999 − 6001) + 8999
assert.equal(sndk.lifetime.callPremium, 4999 + 3999 - 6001 + 8999);
assert.equal(sndk.lifetime.putPremium, 2999);
// Lot: only the 7/9 call, its 7/22 buyback (the roll), and the new 8/21 call
assert.equal(sndk.lot.callPremium, 3999 - 6001 + 8999);
// The 1490 put delivered the shares: its 2999 is folded into the cost basis (Kyle 9/3),
// so basis = 149000 − 2999 and the lot's put column stays 0 (no double count).
assert.equal(sndk.seedPutPremium, 2999);
assert.equal(sndk.totalCost, 146001);
assert.equal(sndk.rawAvgCost, 1460.01);
assert.equal(sndk.lot.putPremium, 0);
assert.equal(sndk.lot.callsWritten, 2);
assert.equal(sndk.lot.adjustedAvgCost, (146001 - 6997) / 100);
assert.equal(sndk.lot.adjustedAvgCostCallsOnly, (146001 - 6997) / 100);
// All-history still nets everything once: (gross 149000 − all premium incl. the put) / 100
assert.equal(sndk.lifetime.adjustedAvgCost, (149000 - (4999 + 3999 - 6001 + 8999) - 2999) / 100);
const seedPut = sndk.legs.find((l) => l.right === "P")!;
assert.equal(seedPut.lotSeed, true);
assert.equal(seedPut.inLot, true);
assert.equal(seedPut.lotNetPremium, 0);
const juneCall = sndk.legs.find((l) => l.strike === 1400)!;
assert.equal(juneCall.inLot, false);
assert.equal(juneCall.lotNetPremium, 0);
const rolled = sndk.legs.find((l) => l.strike === 1550)!;
assert.equal(rolled.inLot, true);
assert.equal(rolled.lotNetPremium, -2002);
assert.equal(rolled.outcome, "closed");
console.log("LOT WINDOW PASS");

// ── CRCL: 100 bought 6/15 + 1000 assigned 7/8; Kyle wants the 100 left out ──
const crclStmt = parseStatementCsv(fx("crcl.csv"), "crcl.csv");
const crclAll = buildReport([crclStmt]).tickers[0];
assert.equal(crclAll.sharesHeld, 1100);
assert.equal(crclAll.lotStart, "2026-06-15 10:00:00"); // the buy started the lot
assert.equal(crclAll.lot.callPremium, 2993.5);
assert.equal(crclAll.warnings.length, 0, crclAll.warnings.join("\n"));
const buyKey = crclAll.stockFills.find((f) => f.quantity === 100)!.fillKey;
const crclEx = buildReport([crclStmt], {}, new Set([buyKey])).tickers[0];
assert.equal(crclEx.sharesHeld, 1000);
assert.equal(crclEx.seedPutPremium, 1993.5);
assert.equal(crclEx.totalCost, 90000 - 1993.5);
assert.equal(crclEx.rawAvgCost, 88.0065);
assert.equal(crclEx.lotStart, "2026-07-08 16:20:00"); // now the assignment starts the lot
assert.equal(crclEx.lot.callPremium, 2993.5);
assert.equal(crclEx.lot.putPremium, 0); // the delivering put lives in the cost basis instead
assert.equal(crclEx.lot.adjustedAvgCost, (90000 - 1993.5 - 2993.5) / 1000);
// With the 100-share buy counted, the lot started at that BUY, so the later put assignment is just an add: not a seed.
assert.equal(crclAll.legs.find((l) => l.right === "P")!.lotSeed, false);
assert.equal(crclAll.lot.putPremium, 1993.5); // ...but it was sold inside the lot anyway
assert.equal(crclAll.seedPutPremium, 0);
assert.equal(crclAll.totalCost, 98001);
assert.equal(crclEx.stockFills.find((f) => f.quantity === 100)!.excluded, true);
assert.equal(crclEx.warnings.length, 0, crclEx.warnings.join("\n")); // IBKR's 1100 still reconciles (1000 + 100 excluded)
console.log("EXCLUDE FILL PASS");

// A starting position for shares that were actually bought inside the history double counts → warn.
const crclDouble = buildReport([crclStmt], { CRCL: { shares: 100, avgCost: 100 } }).tickers[0];
assert.equal(crclDouble.sharesHeld, 1200);
assert.ok(crclDouble.warnings.some((w) => w.includes("double counting")), crclDouble.warnings.join("\n"));
// TSLA in the June fixture really was held before history (prior qty 100) → no such warning.
assert.ok(!tsla2.warnings.some((w) => w.includes("double counting")));
console.log("DOUBLE COUNT WARNING PASS");

// ── A call sold in the PREVIOUS lot but bought back after the new lot began belongs to the old lot ──
const xyz = buildReport([parseStatementCsv(fx("straddle.csv"), "straddle.csv")]).tickers[0];
assert.equal(xyz.lotStart, "2026-07-10 10:00:00");
const straddle = xyz.legs.find((l) => l.strike === 50)!;
assert.equal(straddle.inLot, false);
assert.equal(straddle.lotNetPremium, 0);
assert.equal(straddle.netPremium, -102);
assert.equal(xyz.lot.callPremium, 249); // only the Aug call
assert.equal(xyz.lot.callsWritten, 1);
assert.equal(xyz.lifetime.callPremium, 249 - 102);
// SNDK roll from the earlier fixture still fully inside its lot
assert.equal(sndk.lot.callPremium, 3999 - 6001 + 8999);
console.log("STRADDLE PASS");


// ── Put assigned 7/8 16:20, stock booked 7/9 09:30: still the lot's seed ──
const abc = buildReport([parseStatementCsv(fx("seed-nextday.csv"), "seed-nextday.csv")]).tickers[0];
assert.equal(abc.lotStart, "2026-07-09 09:30:00");
assert.equal(abc.legs.find((l) => l.right === "P")!.lotSeed, true);
assert.equal(abc.seedPutPremium, 299);
assert.equal(abc.totalCost, 5000 - 299);
assert.equal(abc.lot.putPremium, 0);
assert.equal(abc.lot.callPremium, 199);
assert.equal(abc.lot.adjustedAvgCost, (5000 - 299 - 199) / 100);
console.log("SEED NEXT-DAY PASS");
