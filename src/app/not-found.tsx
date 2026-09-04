import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES } from "@/lib/site";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

// A 404 that routes people somewhere useful instead of dead-ending them, and
// keeps itself out of the index.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-4 sm:px-8 py-12 max-w-3xl mx-auto w-full">
        <div className="text-xs uppercase tracking-wider text-gray-500">404</div>
        <h1 className="text-2xl font-extrabold text-gray-100 mt-1 mb-2">That page doesn&apos;t exist</h1>
        <p className="text-sm text-gray-400 mb-6">
          The link is wrong or the page has moved. Here&apos;s everything on the site.
        </p>
        <Link
          href="/"
          className="inline-block text-xs px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold"
        >
          Open the cost basis checker
        </Link>
        <ul className="mt-6 space-y-2">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}`} className="text-sm text-emerald-400 hover:text-emerald-300">
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
