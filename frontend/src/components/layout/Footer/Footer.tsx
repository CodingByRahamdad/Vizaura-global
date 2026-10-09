import Link from "next/link";
import { FooterNewsletter } from "@/components/layout/Footer/FooterNewsletter";
import { FOOTER_LINK_GROUPS, MARKET_OPTIONS } from "@/lib/constants/nav";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-footer text-white">
      <FooterNewsletter />

      <div className="mx-auto grid max-w-[var(--container-max)] grid-cols-2 gap-8 px-5 py-10 md:grid-cols-5 md:px-6">
        <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
          <span className="font-serif text-lg font-semibold">VIZAURA GLOBAL</span>
          <p className="text-sm text-white/70">Nature&apos;s Goodness, Always.</p>
        </div>

        {FOOTER_LINK_GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-2">
            <p className="text-sm font-semibold">{group.title}</p>
            {group.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-white/70 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ))}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Our Markets</p>
          {MARKET_OPTIONS.map((market) => (
            <span key={market.value} className="text-sm text-white/70">
              {market.label}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[var(--container-max)] flex-col items-center justify-between gap-2 px-5 py-4 text-xs text-white/60 md:flex-row md:px-6">
          <p>© {year} VIZAURA GLOBAL. All rights reserved.</p>
          <p>Nature&apos;s Goodness. Your Wellness.</p>
        </div>
      </div>
    </footer>
  );
}
