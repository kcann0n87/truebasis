import { SUPPORT } from "@/lib/support";

// Small donate link for the header / footer. Renders nothing until
// NEXT_PUBLIC_DONATE_URL is set (see src/lib/support.ts).
export function DonateButton({ variant = "header" }: { variant?: "header" | "footer" }) {
  if (!SUPPORT) return null;
  if (variant === "footer") {
    return (
      <a href={SUPPORT.url} target="_blank" rel="noopener noreferrer" className="hover:text-amber-300">
        ☕ {SUPPORT.label}
      </a>
    );
  }
  return (
    <a
      href={SUPPORT.url}
      target="_blank"
      rel="noopener noreferrer"
      title="OptionBasis is free with no account. If it saved you a spreadsheet, it takes tips."
      className="text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-amber-900/60 border border-gray-700 hover:border-amber-700 text-gray-300 hover:text-amber-200 font-semibold whitespace-nowrap"
    >
      ☕ <span className="hidden sm:inline">{SUPPORT.label}</span>
    </a>
  );
}

// Bigger panel, shown under the results once the tool has actually done
// something useful. Deliberately quieter than the broker banner.
export function DonatePanel() {
  if (!SUPPORT) return null;
  return (
    <section className="px-3 sm:px-6 py-4 border-t border-gray-800">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-5 py-4">
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-100">Did this save you an afternoon in a spreadsheet?</div>
          <div className="text-xs text-gray-500 mt-1">
            OptionBasis is free, has no accounts and never sees your statement. It stays that way. Tips cover the domain
            and keep the broker parsers up to date.
          </div>
        </div>
        <a
          href={SUPPORT.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold px-4 py-2 rounded bg-amber-700 hover:bg-amber-600 text-white text-center"
        >
          ☕ {SUPPORT.label}
        </a>
      </div>
    </section>
  );
}
