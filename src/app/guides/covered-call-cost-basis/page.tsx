import type { Metadata } from "next";
import { GuideLayout } from "@/components/GuideLayout";
import { GUIDES } from "@/lib/site";

const meta = GUIDES.find((g) => g.slug === "covered-call-cost-basis")!;
export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  alternates: { canonical: `/guides/${meta.slug}` },
  openGraph: { title: meta.title, description: meta.description, type: "article" },
};

export default function Page() {
  return (
    <GuideLayout meta={meta}>
      <p>
        If you sell covered calls, the price you paid for the shares stops being the number that matters within a few
        weeks. Every call you sell and let expire lowers the price you are effectively in at. Every one you buy back for
        more than you sold it for raises it. After a year of writing calls, the cost basis your broker shows and the
        price you would need to sell at to walk away even can be far apart.
      </p>
      <p>
        This guide gives you the formula, a worked example with a roll and an expiration in it, and the three mistakes
        that make most home-made spreadsheets wrong.
      </p>

      <h2>Two meanings of &ldquo;cost basis&rdquo;</h2>
      <p>
        Your broker and the IRS use <strong>tax cost basis</strong>: what you paid for the shares, adjusted only by a
        few specific events, tracked lot by lot. Premium from a call that expires is a short-term capital gain on its
        own; it does not touch the shares&apos; tax basis.
      </p>
      <p>
        Traders care about a different number: the <strong>adjusted cost basis</strong>, which nets premium against the
        shares to answer &ldquo;where do I really stand on this position?&rdquo;. That is the number this guide is about.
        Use the tax basis for your return; use the adjusted basis for decisions.
      </p>

      <h2>The formula</h2>
      <div className="formula">adjusted cost per share = (cost of the shares held − net option premium) ÷ shares held</div>
      <p>Where:</p>
      <ul>
        <li>
          <strong>Cost of the shares held</strong> is what you paid for the shares you still own, commissions included.
          If you were assigned on a put, it is the strike times the shares, minus the put&apos;s premium (
          <a href="/guides/put-assignment-cost-basis">more on that here</a>).
        </li>
        <li>
          <strong>Net option premium</strong> is every credit you received from selling calls against those shares,
          minus every debit you paid buying calls back, minus commissions. An expired call keeps its full credit.
        </li>
      </ul>
      <p>
        <strong>Break-even</strong> goes one step further and also nets any realized gain or loss from shares you sold
        or had called away along the way. Sell everything at the break-even price and the whole campaign on that stock
        nets to zero.
      </p>

      <h2>A worked example</h2>
      <p>Suppose you bought 100 shares of XYZ at $140 on June 2 and then wrote calls against them:</p>
      <table>
        <thead>
          <tr><th>Date</th><th>Trade</th><th className="num">Cash</th></tr>
        </thead>
        <tbody>
          <tr><td>Jun 2</td><td>Buy 100 XYZ @ $140 (+$1 commission)</td><td className="num">−$14,001.00</td></tr>
          <tr><td>Jun 3</td><td>Sell 1 Jun 19 $150 call @ $3.50</td><td className="num">+$348.70</td></tr>
          <tr><td>Jun 19</td><td>$150 call expires worthless</td><td className="num">$0.00</td></tr>
          <tr><td>Jun 22</td><td>Sell 1 Jul 17 $155 call @ $4.00</td><td className="num">+$398.70</td></tr>
          <tr><td>Jun 28</td><td>Buy back the $155 call @ $1.50</td><td className="num">−$151.30</td></tr>
          <tr><td>Jun 28</td><td>Sell 1 Aug 21 $160 call @ $5.00</td><td className="num">+$498.70</td></tr>
        </tbody>
      </table>
      <p>
        Net premium so far is $348.70 + $398.70 − $151.30 + $498.70 = <strong>$1,094.80</strong>. Cost of the shares is
        $14,001.00. So:
      </p>
      <div className="formula">($14,001.00 − $1,094.80) ÷ 100 = $129.06 per share</div>
      <p>
        You paid $140.01 a share. After four weeks of writing calls you are effectively in at $129.06. If XYZ is trading
        at $135, the brokerage screen shows a loss on the shares, and you are actually up.
      </p>

      <h2>The three mistakes that break spreadsheets</h2>
      <h3>1. Counting the roll only once</h3>
      <p>
        A roll is two trades: you bought the $155 call back for $151.30 and sold the $160 call for $498.70. The buyback
        is a debit against the old contract; the new credit belongs to the new contract. Both go into net premium. If
        you only record the &ldquo;net credit of the roll&rdquo; you will get the same total, but you lose the ability
        to see which contracts lost money, and one day you will record a roll as a single credit and be off by the
        buyback.
      </p>
      <h3>2. Mixing premium from shares you no longer own</h3>
      <p>
        If your shares got called away in March and you were assigned on a new lot in July, the calls you wrote in
        February belong to the March campaign. They were real profit, but they are not part of what the July shares
        cost you. Start the clock at the fill that took the position from zero to something, and count only contracts
        sold after that.
      </p>
      <h3>3. Forgetting the put that delivered the shares</h3>
      <p>
        When shares arrive by put assignment, the premium from that put is part of what you paid. Leave it out and your
        basis is too high, usually by a few percent, which is the whole edge of the strategy. Interactive Brokers folds
        it in automatically in the average price it shows; most spreadsheets do not.
      </p>

      <h2>Doing this across statements</h2>
      <p>
        The hard part is not the arithmetic. It is matching hundreds of fills to the right contract, deciding which
        contracts belong to the shares you hold now, and handling the odd cases: partial fills, a call sold before the
        statement you have, a roll that crossed a month boundary. That is exactly what a statement parser is for, and it
        is why OptionBasis exists. Drop in a statement, expand a stock, and you can see every contract, its outcome, and
        the adjusted basis it produced.
      </p>
    </GuideLayout>
  );
}
