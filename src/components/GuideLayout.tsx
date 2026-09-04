import Link from "next/link";
import type { ReactNode } from "react";
import { GUIDES, SITE_NAME, SITE_URL, type GuideMeta } from "@/lib/site";

// Shared shell for /guides/* articles: header, article JSON-LD, prose
// styles (globals.css `.guide`), "try it" call to action, related guides.
export function GuideLayout({ meta, children }: { meta: GuideMeta; children: ReactNode }) {
  const url = `${SITE_URL}/guides/${meta.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.published,
    dateModified: meta.updated,
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
  const related = GUIDES.filter((g) => g.slug !== meta.slug);
  return (
    <main className="min-h-screen bg-gray-950 text-gray-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-8 py-3 flex items-center gap-3 text-xs">
        <Link href="/" className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300">← {SITE_NAME}</Link>
        <Link href="/guides" className="text-gray-400 hover:text-gray-200">Guides</Link>
      </div>
      <article className="guide px-4 sm:px-8 py-8 max-w-3xl mx-auto">
        <div className="text-xs text-gray-500 mb-3">
          {meta.readMinutes} min read · updated {meta.updated}
        </div>
        <h1>{meta.title}</h1>
        {children}
        <div className="not-prose mt-10 bg-gray-900 border border-emerald-900/60 rounded-lg px-5 py-4">
          <div className="text-sm font-semibold text-gray-100">Do this on your own statement in one drop</div>
          <div className="text-xs text-gray-400 mt-1">
            TrueBasis reads an IBKR or Robinhood statement in your browser and works out the adjusted basis, per stock,
            with every roll, buyback and assignment handled. Nothing is uploaded.
          </div>
          <Link href="/" className="inline-block mt-3 text-xs px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold">
            Open TrueBasis
          </Link>
        </div>
        {related.length > 0 && (
          <div className="not-prose mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">More guides</div>
            <ul className="space-y-1">
              {related.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}`} className="text-sm text-emerald-400 hover:text-emerald-300">{g.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="not-prose mt-8 text-[11px] text-gray-500">
          Not investment or tax advice. Cost basis here is a trading view (average-cost method); your broker&apos;s tax
          documents use lot-based rules. See the <Link href="/disclaimer" className="underline">disclaimer</Link>.
        </div>
      </article>
    </main>
  );
}
