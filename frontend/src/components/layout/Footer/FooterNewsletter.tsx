"use client";

import type { FormEvent } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SocialIcon, type SocialPlatform } from "@/components/ui/SocialIcon";
import { SOCIAL_LINKS } from "@/lib/constants/nav";

const PLATFORM_BY_LABEL: Record<string, SocialPlatform> = {
  Facebook: "facebook",
  Instagram: "instagram",
  TikTok: "tiktok",
  YouTube: "youtube",
  Pinterest: "pinterest",
};

export function FooterNewsletter() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Newsletter subscription is wired up in a later phase once the backend
    // notifications/marketing endpoint contract is implemented on the frontend.
    event.preventDefault();
  }

  return (
    <div className="border-b border-white/10">
      <div className="mx-auto flex max-w-[var(--container-max)] flex-col items-center justify-between gap-4 px-6 py-6 lg:flex-row">
        <div className="flex items-center gap-3 text-white">
          <Mail className="h-5 w-5" aria-hidden />
          <div>
            <p className="font-medium">Stay Updated</p>
            <p className="text-sm text-white/70">
              Get exclusive offers, new arrivals and wellness tips.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-2">
          <Input
            type="email"
            required
            placeholder="Enter your email address"
            aria-label="Email address"
            className="border-white/20 bg-white/5 text-white placeholder:text-white/60"
          />
          <Button type="submit" variant="primary">
            Subscribe
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 lg:items-end">
          <p className="text-sm font-medium text-white">Follow Us</p>
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map((link) => {
              const platform = PLATFORM_BY_LABEL[link.label];
              if (!platform) return null;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <SocialIcon platform={platform} className="h-4 w-4" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
