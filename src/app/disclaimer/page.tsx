import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Disclaimer: a calculator, not advice",
  description:
    "OptionBasis computes a trading view of cost basis using the average-cost method. It is not investment, tax or legal advice, and it is not what your broker files.",
  alternates: { canonical: "/disclaimer" },
};

export default function Disclaimer() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-4 sm:px-8 py-8 max-w-3xl mx-auto text-sm leading-relaxed">
      <h1 className="text-2xl font-bold text-emerald-400 mb-4">Disclaimer</h1>
      <p className="mb-3">
        OptionBasis is a calculator, not advice. Nothing on this site is investment, tax, legal or accounting advice, and
        nothing here is a recommendation to buy, sell or hold any security or to use any options strategy.
      </p>
      <p className="mb-3">
        <strong>The numbers are a trading view, not a tax view.</strong> Share cost basis is computed with the
        average-cost method and option premium is netted against it. Your broker and the IRS use lot-based methods and
        treat option premium differently (for example, an assigned put&apos;s premium adjusts the stock&apos;s basis, while
        an expired call&apos;s premium is a short-term gain). Use your broker&apos;s tax documents for tax reporting.
      </p>
      <p className="mb-3">
        <strong>Accuracy.</strong> Results depend entirely on the statements you load. Missing months, unsupported
        brokers, corporate actions, and unusual fills can all produce wrong numbers. The tool flags the cases it can
        detect; verify anything you rely on.
      </p>
      <p className="mb-3">
        <strong>Referrals and ads.</strong> Some links are broker referral links; we may be compensated if you open an
        account through them. That does not influence the calculations.
      </p>
      <p className="mb-3">Options involve risk and are not suitable for all investors.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
