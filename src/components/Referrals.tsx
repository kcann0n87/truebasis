import { AFFILIATES } from "@/lib/affiliates";

// Broker referral block. Renders nothing until at least one link is set in
// the env (see src/lib/affiliates.ts). Disclosure is required by the FTC and
// by every broker referral program.
export function Referrals() {
  if (AFFILIATES.length === 0) return null;
  return (
    <section className="px-3 sm:px-6 py-4 border-t border-gray-800">
      <div className="text-sm font-semibold text-gray-200">Brokers that make this easy</div>
      <div className="text-xs text-gray-500 mt-0.5 mb-2">
        Selling covered calls needs a broker with good option fills and exportable statements. These are referral links:
        opening an account through them supports this site at no cost to you.
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {AFFILIATES.map((a) => (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="block bg-gray-900 border border-gray-800 hover:border-emerald-700 rounded-lg px-4 py-3"
          >
            <div className="text-sm font-semibold text-gray-100">{a.name} →</div>
            <div className="text-xs text-gray-500 mt-1">{a.blurb}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
