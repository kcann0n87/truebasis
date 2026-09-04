import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES, SITE_NAME, SITE_URL } from "@/lib/site";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Guides: covered-call cost basis, assignment and rolling",
  description:
    "Plain-English guides to working out what your shares really cost after covered-call premium, put assignment and rolls, with worked examples.",
  alternates: { canonical: "/guides" },
  openGraph: { type: "website", url: "/guides" },
};

// Collection page + breadcrumbs so the guides index can surface as a hub
// rather than competing with the individual articles.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/guides#page`,
      url: `${SITE_URL}/guides`,
      name: "Guides",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      hasPart: GUIDES.map((g) => ({
        "@type": "Article",
        headline: g.title,
        description: g.description,
        url: `${SITE_URL}/guides/${g.slug}`,
        datePublished: g.published,
        dateModified: g.updated,
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
      ],
    },
  ],
};

export default function GuidesIndex() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader current="guides" />
      <main className="flex-1 px-4 sm:px-8 py-8 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-extrabold text-gray-100 mb-2">Guides</h1>
        <p className="text-sm text-gray-400 mb-6">
          How covered-call premium, put assignment and rolling change what your shares actually cost you. Short, with
          worked numbers.
        </p>
        <ul className="space-y-3">
          {GUIDES.map((g) => (
            <li key={g.slug} className="bg-gray-900 border border-gray-800 rounded-lg px-5 py-4">
              <Link href={`/guides/${g.slug}`} className="text-base font-semibold text-emerald-400 hover:text-emerald-300">
                {g.title}
              </Link>
              <p className="text-sm text-gray-400 mt-1">{g.description}</p>
              <div className="text-xs text-gray-500 mt-2">{g.readMinutes} min read · updated {g.updated}</div>
            </li>
          ))}
        </ul>
        <div className="mt-8 bg-gray-900 border border-emerald-900/60 rounded-lg px-5 py-4">
          <div className="text-sm font-semibold text-gray-100">Skip the arithmetic</div>
          <div className="text-xs text-gray-400 mt-1">
            Drop an Interactive Brokers or Robinhood statement into the checker and it does all of this per stock — rolls,
            buybacks and assignments included. Free, no account, nothing uploaded.
          </div>
          <Link href="/" className="inline-block mt-3 text-xs px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold">
            Open the cost basis checker
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
