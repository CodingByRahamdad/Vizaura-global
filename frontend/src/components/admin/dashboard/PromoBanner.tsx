import Link from "next/link";

/// Points at the now-real Promotions module (backend/src/modules/promotions/)
/// — previously a disabled "coming in a later phase" placeholder.
export function PromoBanner() {
  return (
    <div className="flex h-full flex-col justify-center gap-3 rounded-xl bg-footer p-6 text-white">
      <span className="w-fit rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide">
        Special Promotion
      </span>
      <h3 className="font-serif text-lg font-semibold">Natural Wellness for a Healthier You</h3>
      <p className="text-sm text-white/70">Create and manage homepage promotions from here.</p>
      <Link
        href="/admin/promotions"
        className="w-fit rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30"
      >
        Manage Promotions →
      </Link>
    </div>
  );
}
