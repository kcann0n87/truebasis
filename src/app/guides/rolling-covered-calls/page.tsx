import { GuideLayout } from "@/components/GuideLayout";
import { GUIDES, guideMetadata } from "@/lib/site";

const meta = GUIDES.find((g) => g.slug === "rolling-covered-calls")!;
export const metadata = guideMetadata("rolling-covered-calls");

export default function Page() {
  return (
    <GuideLayout meta={meta}>
      <p>
        Rolling a covered call means buying back the call you are short and selling a different one, usually further
        out in time and often at a higher strike. It is one order at the broker but it is two trades, and the way you
        record them decides whether your cost-basis math stays honest.
      </p>

      <h2>A roll is a buyback plus a sale</h2>
      <p>
        Say you are short a July $155 call you sold for $4.00. The stock ran up, the call is now $6.00, and you roll to
        an August $160 call at $9.00. At the broker that is a single order with a net credit of $3.00. In your records
        it should be:
      </p>
      <table>
        <thead>
          <tr><th>Contract</th><th>What happened</th><th className="num">Cash</th></tr>
        </thead>
        <tbody>
          <tr><td>Jul $155 call</td><td>Sold @ $4.00, bought back @ $6.00</td><td className="num">−$200 + commissions</td></tr>
          <tr><td>Aug $160 call</td><td>Sold @ $9.00, still open</td><td className="num">+$900 − commissions</td></tr>
        </tbody>
      </table>
      <p>
        The July contract lost $200. The August contract has collected $900. Net premium on the shares went up by $700,
        and both of those facts are true at once. If you only wrote down &ldquo;roll, +$3.00&rdquo;, you can never see
        that the July call was a loser, and you will not learn anything from it.
      </p>

      <h2>Why the losing half matters</h2>
      <p>
        A roll for a debit is the case people get wrong. You are short a $150 call that is deep in the money at $12 and
        you roll to a $165 call at $9 to keep the shares. Net debit $3.00. Your spreadsheet shows a $300 loss and the
        position feels like it is going badly.
      </p>
      <p>
        But look at the shares. You just moved your cap from $150 to $165, a $15 a share improvement, for $3 a share.
        Your adjusted basis went <em>up</em> by $3, and your maximum outcome went up by $15. Whether that was a good
        trade depends on where the stock goes, but the &ldquo;loss&rdquo; is not a loss on the position; it is the price
        of more upside. You only see that if the buyback is charged to the old contract and the shares&apos; basis is
        tracked separately.
      </p>

      <h2>Which shares does the premium belong to?</h2>
      <p>
        Rolls chain across months, and the shares underneath can change. Three rules keep it straight:
      </p>
      <ol>
        <li>
          <strong>A contract belongs to the shares it was sold against.</strong> If you sold a call in February on
          shares that were called away in March, that call&apos;s premium, and its buyback if you rolled it, belong to
          the March campaign. It does not count toward shares you were assigned on in July.
        </li>
        <li>
          <strong>The buyback stays with its contract.</strong> Charge the debit to the call you closed, credit the new
          sale to the new call. Net premium is the sum of all contracts on the current shares.
        </li>
        <li>
          <strong>Count the roll only once.</strong> Either record both legs, or record the net. Never record the net
          and one of the legs.
        </li>
      </ol>

      <h2>Rolls that cross a statement boundary</h2>
      <p>
        The annoying case: you sold the call in one month&apos;s statement and bought it back in the next, and you only
        have the second statement. The buyback shows up as a pure debit, with no credit to net it against, and your
        premium total is understated. If the broker reports realized P&amp;L per fill, as IBKR does, use that figure for
        the buyback; it already nets the original credit. Otherwise upload the earlier statement so both legs are in
        view.
      </p>

      <h2>What to look at each week</h2>
      <p>
        Two numbers per stock: the adjusted cost per share, and how much of the cost basis premium has paid back so
        far. If the stock is above your adjusted basis, the campaign is profitable regardless of what the brokerage
        screen says about the shares. If a roll pushes the basis up, ask whether the extra upside was worth it. That is
        the whole discipline, and it only works if the rolls are recorded as what they are.
      </p>
    </GuideLayout>
  );
}
