import Link from "next/link";

export const metadata = { title: "Privacy — OptionBasis" };

export default function Privacy() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-200 px-4 sm:px-8 py-8 max-w-3xl mx-auto text-sm leading-relaxed">
      <Link href="/" className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 inline-block mb-4">← OptionBasis</Link>
      <h1 className="text-2xl font-bold text-emerald-400 mb-4">Privacy</h1>
      <p className="mb-3">
        <strong>Your statement never leaves your browser.</strong> When you drop a file into OptionBasis it is read and
        parsed by JavaScript running on your own device. No file, no trade, no account number and no computed result is
        transmitted to us or to anyone else. There is no upload endpoint to send it to.
      </p>
      <p className="mb-3">
        <strong>Nothing is stored unless you ask.</strong> By default, refreshing or closing the page discards everything.
        If you tick &ldquo;Remember on this device&rdquo;, the statement text and your settings are kept in your
        browser&apos;s local storage, on that device only. Untick the box or use &ldquo;Clear everything&rdquo; to remove it.
      </p>
      <p className="mb-3">
        <strong>What we do see.</strong> Standard, anonymous web-server logs (page requests, browser type, coarse
        location) from our hosting provider, and, if enabled, aggregate analytics with no personal identifiers. Referral
        links to brokers take you to their sites, which have their own privacy policies.
      </p>
      <p className="mb-3">
        <strong>Ads.</strong> If advertising is shown, the ad network may set cookies on its own domain. Ad scripts do
        not have access to the contents of your statement, which exists only in the page&apos;s memory.
      </p>
      <p className="text-gray-500 text-xs mt-6">Questions: open an issue on the project&apos;s GitHub repository.</p>
    </main>
  );
}
