import { AFFILIATES } from "@/lib/affiliates";

// Full-width clickable IBKR referral banner (Kyle 9/3). Sits under the upload
// area so it's seen without scrolling. Bonus wording mirrors IBKR's own
// "Refer a Friend" banner; keep it in step with their program terms.
export function ReferralBanner() {
  const ibkr = AFFILIATES.find((a) => a.id === "ibkr");
  if (!ibkr) return null;
  return (
    <a
      href={ibkr.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="group block mx-3 sm:mx-6 my-3 rounded-lg border border-red-900/60 bg-gradient-to-r from-red-950/70 via-gray-900 to-gray-900 hover:border-red-700 px-4 sm:px-6 py-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="shrink-0 text-2xl">🎁</div>
        <div className="flex-1">
          <div className="text-sm sm:text-base font-bold text-gray-100">
            Sell covered calls at Interactive Brokers — the broker this tool was built on
          </div>
          <div className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Open an account through this link and get <span className="text-gray-200">up to $1,000 in IBKR stock</span> under
            IBKR&apos;s Refer-a-Friend program. Lowest option commissions of the big brokers, and statements that drop
            straight into OptionBasis.
          </div>
        </div>
        <div className="shrink-0 text-xs font-semibold text-white bg-red-700 group-hover:bg-red-600 rounded px-3 py-2 text-center">
          Open an account →
        </div>
      </div>
      <div className="text-[10px] text-gray-600 mt-2">Referral link: we&apos;re compensated if you open and fund an account. It doesn&apos;t change the calculations.</div>
    </a>
  );
}
