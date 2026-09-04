import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";
import { DonateButton } from "./DonateButton";

// The ledger mark from app/icon.tsx: three lines stepping down to the basis.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-flex flex-col justify-center gap-[3px] ${className}`}>
      <span className="block h-[3px] w-5 rounded-full bg-gray-500" />
      <span className="block h-[3px] w-[13px] rounded-full bg-gray-500" />
      <span className="block h-[4px] w-[9px] rounded-full bg-emerald-400" />
    </span>
  );
}

// One nav bar for every page. `actions` slots page-specific buttons in on the
// right (the home page puts "Try the demo" there). Keeping the links identical
// everywhere is also what gives the guides a route back into the tool.
export function SiteHeader({ actions, current }: { actions?: ReactNode; current?: "home" | "guides" }) {
  const link = (href: string, label: string, key: "home" | "guides") =>
    current === key ? (
      <span key={href} aria-current="page" className="text-xs font-semibold text-gray-200">{label}</span>
    ) : (
      <Link key={href} href={href} className="text-xs font-semibold text-gray-400 hover:text-gray-200">{label}</Link>
    );
  return (
    <header className="bg-gray-900 border-b border-gray-800">
      <nav className="px-3 sm:px-6 py-2.5 flex items-center gap-3 sm:gap-5" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <Logo />
          <span className="text-sm font-bold text-emerald-400 group-hover:text-emerald-300">{SITE_NAME}</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          {link("/", "Checker", "home")}
          {link("/guides", "Guides", "guides")}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DonateButton />
          {actions}
        </div>
      </nav>
    </header>
  );
}
