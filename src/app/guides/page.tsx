import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Guides: covered-call cost basis, assignment and rolling",
  description:
    "Plain-English guides to working out what your shares really cost after covered-call premium, put assignment and rolls, with worked examples.",
  alternates: { canonical: "/guides" },
};

export default function GuidesIndex() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-200">
      <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-8 py-3 text-xs">
        <Link href="/" className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300">← {SITE_NAME}</Link>
      </div>
      <div className="px-4 sm:px-8 py-8 max-w-3xl mx-auto">
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
              <div className="text-xs text-gray-500 mt-2">{g.readMinutes} min read</div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
