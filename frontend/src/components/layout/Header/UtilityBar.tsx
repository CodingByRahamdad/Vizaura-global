import Link from "next/link";
import { MarketSwitcher } from "@/components/layout/Header/MarketSwitcher";

export function UtilityBar() {
  return (
    <div className="hidden bg-primary-dark text-white md:block">
      <div className="mx-auto flex max-w-[var(--container-max)] items-center justify-between px-6 py-2 text-xs">
        <p>Free Shipping on orders above 10,000 PKR / 300 AED</p>
        <div className="flex items-center gap-4">
          <MarketSwitcher />
          <Link href="/account/orders" className="hover:underline">
            Track Order
          </Link>
          <Link href="/contact" className="hover:underline">
            Need Help?
          </Link>
        </div>
      </div>
    </div>
  );
}
