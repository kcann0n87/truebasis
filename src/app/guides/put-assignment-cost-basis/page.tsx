import type { Metadata } from "next";
import { GuideLayout } from "@/components/GuideLayout";
import { GUIDES } from "@/lib/site";

const meta = GUIDES.find((g) => g.slug === "put-assignment-cost-basis")!;
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
        You sold a cash-secured put, the stock closed below the strike at expiration, and now you own the shares. The
        question that matters is not &ldquo;what was the strike?&rdquo; but &ldquo;what did I actually pay?&rdquo;. The
        answer is lower than the strike, and the difference is the whole point of selling the put.
      </p>

      <h2>The formula</h2>
      <div className="formula">cost per share = strike − (put premium received per share, net of commissions)</div>
      <p>
        You sold the put for a credit. That cash is yours whether or not you get assigned. When you are assigned, you
        pay the strike for the shares, so the credit effectively discounts the purchase.
      </p>

      <h2>Worked example</h2>
      <p>
        On June 20 you sell one XYZ $1,490 put expiring July 17 for $30.00, collecting $2,999 after a $1 commission.
        On July 17 the stock closes at $1,450 and you are assigned 100 shares at $1,490.
      </p>
      <table>
        <thead>
          <tr><th></th><th className="num">Per share</th><th className="num">Total</th></tr>
        </thead>
        <tbody>
          <tr><td>Strike paid</td><td className="num">$1,490.00</td><td className="num">$149,000.00</td></tr>
          <tr><td>Put premium collected</td><td className="num">−$29.99</td><td className="num">−$2,999.00</td></tr>
          <tr><td><strong>Cost basis</strong></td><td className="num"><strong>$1,460.01</strong></td><td className="num"><strong>$146,001.00</strong></td></tr>
        </tbody>
      </table>
      <p>
        The stock is at $1,450. Against the strike you look $40 a share under water. Against your real cost you are
        $10 under. That is a different decision about what call to sell next.
      </p>

      <h2>This is also what your broker does</h2>
      <p>
        Interactive Brokers shows the assigned shares at $1,460.01 in the Average Price column, not $1,490. It nets the
        put premium into the stock&apos;s basis automatically. Robinhood and Schwab do the same in their cost-basis
        views. So if a spreadsheet says $1,490 and the broker says $1,460, the broker is right.
      </p>
      <div className="callout">
        <p>
          For tax purposes this one is also true: premium from a put that is assigned reduces the basis of the shares
          acquired. It is the expired-call premium that is treated differently (as a gain of its own).
        </p>
      </div>

      <h2>Now sell calls against it</h2>
      <p>
        The shares are yours at $1,460.01. Every covered call you write from here on comes off that number, not off the
        strike. Sell a $1,550 call for $40 and let it expire, and you are at $1,420.02. Get called away at $1,550 and
        the campaign made $1,550 − $1,460.01 + the call premium per share, on shares you were paid to buy.
      </p>
      <p>
        One subtlety: the put&apos;s premium belongs to <em>these</em> shares. If you later sell them and are assigned
        on a new put, that is a new lot with its own put, and the old premium was profit on the old lot. Keep the two
        separate or you will double count.
      </p>

      <h2>Assigned on more than one put</h2>
      <p>
        If you bought 100 shares outright, then were assigned on ten puts for another 1,000, the ten puts&apos; premium
        still reduces the basis of the combined position. The order the shares arrived in does not matter; what matters
        is that the shares delivered by an assigned put came with a discount attached. Interactive Brokers handles this
        the same way, which is a useful check: your computed average cost should match theirs to the cent when your
        history is complete.
      </p>
    </GuideLayout>
  );
}
