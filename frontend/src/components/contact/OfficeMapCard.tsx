import { Clock, MapPin } from "lucide-react";
import { OFFICE_ADDRESS, OFFICE_HOURS, OFFICE_MAP_QUERY } from "@/lib/constants/contact-content";

export function OfficeMapCard() {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(OFFICE_MAP_QUERY)}&output=embed`;

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm md:p-8">
      <div className="relative h-48 w-full overflow-hidden rounded-md border border-border">
        <iframe
          src={mapSrc}
          title="VIZAURA GLOBAL office location map"
          loading="lazy"
          className="h-full w-full border-0"
        />
        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-primary-dark px-3 py-1.5 text-xs font-medium text-white shadow-sm">
          VIZAURA GLOBAL — Lahore, Pakistan
        </span>
      </div>

      <h3 className="mt-5 font-serif text-xl font-semibold text-text">Visit Our Office</h3>
      <p className="mt-1 text-sm text-text-secondary">
        We&apos;d love to welcome you to our office. Please visit us during our business hours.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-text-secondary">{OFFICE_ADDRESS}</p>
        </div>
        <div className="flex items-start gap-2.5">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-text-secondary">{OFFICE_HOURS}</p>
        </div>
      </div>
    </div>
  );
}
