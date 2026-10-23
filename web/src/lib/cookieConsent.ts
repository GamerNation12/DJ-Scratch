"use client";

import { useEffect, useState } from "react";

export const COOKIE_CONSENT_KEY = "dj-scratch-cookie-consent";
export const COOKIE_CONSENT_EVENT = "cookie-consent-change";
export const COOKIE_CONSENT_OPEN_EVENT = "cookie-consent-open";

export type CookieConsentValue = "all" | "essential";

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsentValue | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const read = () => {
      const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
      setConsent(stored === "all" || stored === "essential" ? stored : null);
      setReady(true);
    };

    read();
    window.addEventListener(COOKIE_CONSENT_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  return { consent, ready };
}

export function saveCookieConsent(value: CookieConsentValue) {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  document.cookie = `${COOKIE_CONSENT_KEY}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}
