// Ad placement. Intentionally empty until an ad network is chosen: drop the
// network's tag in here (or a Carbon / EthicalAds embed if the privacy pitch
// matters more than RPM) and set NEXT_PUBLIC_ADS=1 to show it. Keeping it as
// a component means the layout already reserves the spot.
export function AdSlot({ slot }: { slot: string }) {
  if (process.env.NEXT_PUBLIC_ADS !== "1") return null;
  return (
    <div
      data-ad-slot={slot}
      className="mx-3 sm:mx-6 my-3 min-h-24 rounded border border-dashed border-gray-800 flex items-center justify-center text-[11px] text-gray-600"
    >
      ad
    </div>
  );
}
