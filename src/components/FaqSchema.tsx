import { FAQ } from "@/lib/site";

// FAQPage structured data. Server component, mounted only on the page that
// renders the questions visibly — Google requires the schema to match what a
// visitor can actually see.
export function FaqSchema() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
