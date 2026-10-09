"use client";

import { useEffect, useId, useRef } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; "error-callback"?: () => void }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Turnstile script"));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

interface TurnstileProps {
  onVerify: (token: string) => void;
}

/**
 * Real Cloudflare Turnstile widget — CAPTCHA is never faked or bypassed
 * client-side. NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset in production until a
 * real site key is configured (see docs/CURRENT_TASK.md); local development
 * uses Cloudflare's official public "always passes" test site key
 * (1x00000000000000000000AA — documented at
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/, not
 * a secret), which still renders and exercises the real widget/callback flow.
 */
export function Turnstile({ onVerify }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const id = useId();

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: onVerify,
      });
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [onVerify]);

  if (!SITE_KEY) {
    return (
      <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
        CAPTCHA is not configured for this environment (NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset).
      </p>
    );
  }

  return <div ref={containerRef} id={id} />;
}
