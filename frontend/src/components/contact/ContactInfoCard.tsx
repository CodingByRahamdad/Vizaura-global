import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { CONTACT_INFO_ROWS, SOCIAL_PLATFORMS_CONTACT } from "@/lib/constants/contact-content";

const ICONS = { mapPin: MapPin, phone: Phone, mail: Mail, whatsapp: MessageCircle } as const;

export function ContactInfoCard() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-primary-light/30 p-6 shadow-sm md:p-8">
      <h2 className="font-serif text-2xl font-semibold text-text">Contact Information</h2>
      <p className="mt-1 text-sm text-text-secondary">You can also reach us through these channels.</p>

      <div className="mt-5 divide-y divide-border">
        {CONTACT_INFO_ROWS.map((row) => {
          const Icon = ICONS[row.icon];
          return (
            <div key={row.label} className="flex items-start gap-3 py-3.5 first:pt-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-dark">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-text">{row.label}</p>
                <p className="text-sm text-text-secondary">{row.value}</p>
                {row.sub ? <p className="text-xs text-text-secondary">{row.sub}</p> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        {SOCIAL_PLATFORMS_CONTACT.map((social) => (
          <a
            key={social.label}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.label}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-primary-dark transition-colors hover:bg-primary-light"
          >
            <SocialIcon platform={social.platform} className="h-4 w-4" />
          </a>
        ))}
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        Follow us for the latest updates, wellness tips and offers.
      </p>
    </div>
  );
}
