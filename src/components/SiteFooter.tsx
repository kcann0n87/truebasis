import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { DonateButton } from "./DonateButton";

// Shared footer. The guide links are here on purpose: every page ends with a
// route into the content, which is most of the internal linking this site has.
export function SiteFooter() {
  return (
    <footer className="px-3 sm:px-6 py-5 border-t border-gray-800 text-[11px] text-gray-500">
      <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
        <span>© {new Date().getFullYear()} {SITE_NAME}</span>
        <Link href="/" className="hover:text-gray-300">Cost basis checker</Link>
        <Link href="/guides" className="hover:text-gray-300">Guides</Link>
        <Link href="/privacy" className="hover:text-gray-300">Privacy</Link>
        <Link href="/disclaimer" className="hover:text-gray-300">Disclaimer</Link>
        <DonateButton variant="footer" />
      </div>
      <div className="mt-2 max-w-3xl">
        Not investment, legal or tax advice. Cost basis here is a trading view using the average-cost method; your
        broker&apos;s tax documents use lot-based rules and are the figures to file with.
      </div>
    </footer>
  );
}
