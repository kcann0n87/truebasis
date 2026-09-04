import Link from "next/link";
import type { ReactNode } from "react";
import { GUIDES, SITE_NAME, SITE_URL, type GuideMeta } from "@/lib/site";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

// Shared shell for /guides/* articles: nav, article JSON-LD, prose styles
// (globals.css `.guide`), "try it" call to action, related guides.
export function GuideLayout({ meta, children }: { meta: GuideMeta; children: ReactNode }) {
  const url = `${SITE_URL}/guides/${meta.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: meta.title,
        description: meta.description,
        datePublished: meta.published,
        dateModified: meta.updated,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        url,
        inLanguage: "en-US",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        author: { "@id": `${SITE_URL}/#organization` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        about: { "@id": `${SITE_URL}/#app` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
          { "@type": "ListItem", position: 3, name: meta.title, item: url },
        ],
      },
    ],
  };
  const related = GUIDES.filter((g) => g.slug !== meta.slug);
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader current="guides" />
      <article className="guide flex-1 px-4 sm:px-8 py-8 max-w-3xl mx-auto w-full">
        <nav aria-label="Breadcrumb" className="not-prose text-xs text-gray-500 mb-3">
          <Link href="/" className="hover:text-gray-300">{SITE_NAME}</Link>
          <span className="mx-1.5">/</span>
          <Link href="/guides" className="hover:text-gray-300">Guides</Link>
        </nav>
        <div className="text-xs text-gray-500 mb-3">
          {meta.readMinutes} min read · updated {meta.updated}
        </div>
        <h1>{meta.title}</h1>
        {children}
        <div className="not-prose mt-10 bg-gray-900 border border-emerald-900/60 rounded-lg px-5 py-4">
          <div className="text-sm font-semibold text-gray-100">Do this on your own statement in one drop</div>
          <div className="text-xs text-gray-400 mt-1">
            OptionBasis reads an IBKR or Robinhood statement in your browser and works out the adjusted basis, per stock,
            with every roll, buyback and assignment handled. Nothing is uploaded.
          </div>
          <Link href="/" className="inline-block mt-3 text-xs px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold">
            Open OptionBasis
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
      <SiteFooter />
    </div>
  );
}
