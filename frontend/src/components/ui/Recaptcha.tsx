"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from "react";

const SCRIPT_SRC = "https://www.google.com/recaptcha/api.js";
const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => number;
      reset: (widgetId?: number) => void;
      ready: (callback: () => void) => void;
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (window.grecaptcha) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      // render=explicit: we call grecaptcha.render() ourselves once the
      // script is ready, rather than auto-rendering every g-recaptcha div.
      script.src = `${SCRIPT_SRC}?render=explicit`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load reCAPTCHA script"));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

export interface RecaptchaHandle {
  reset: () => void;
}

interface RecaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

/**
 * Visible Google reCAPTCHA v2 "I'm not a robot" checkbox, rendered in
 * explicit mode via grecaptcha.render(). The script is loaded once and
 * shared across every instance on the page (module-level promise cache,
 * same pattern as the Turnstile widget).
 */
export const Recaptcha = forwardRef<RecaptchaHandle, RecaptchaProps>(function Recaptcha(
  { onVerify, onExpire, onError },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const id = useId();

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    loadRecaptchaScript().then(() => {
      if (cancelled || !containerRef.current || !window.grecaptcha) return;
      window.grecaptcha.ready(() => {
        if (cancelled || !containerRef.current || !window.grecaptcha) return;
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: onVerify,
          "expired-callback": onExpire,
          "error-callback": onError,
        });
      });
    });

    return () => {
      cancelled = true;
    };
    // Callbacks are bound once at render() time — re-running this effect on
    // every callback identity change would re-render the widget and reset
    // the checkbox unexpectedly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) {
    return (
      <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
        CAPTCHA is not configured for this environment (NEXT_PUBLIC_RECAPTCHA_SITE_KEY is unset).
      </p>
    );
  }

  return <div ref={containerRef} id={id} />;
});
