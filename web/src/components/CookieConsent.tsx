"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  COOKIE_CONSENT_KEY,
  COOKIE_CONSENT_OPEN_EVENT,
  saveCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookieConsent";

export default function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    setVisible(stored !== "all" && stored !== "essential");
    setMounted(true);

    const open = () => setVisible(true);
    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, open);
    return () =>
      window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, open);
  }, []);

  const choose = (value: CookieConsentValue) => {
    saveCookieConsent(value);
    setVisible(false);
  };

  if (!mounted || !visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-5"
    >
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#140a22]/95 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="h-1 w-full bg-gradient-to-r from-fuchsia-500 via-purple-400 to-lime-300" />
        <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-white">Cookies &amp; ads</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400 sm:text-sm">
              We use essential cookies to keep DJ Scratch working. With your
              permission, we also use optional cookies to measure traffic and
              show ads.{" "}
              <Link
                href="/privacy"
                className="text-fuchsia-300 underline underline-offset-2 transition-colors hover:text-fuchsia-200"
              >
                Privacy policy
              </Link>
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
            <button
              type="button"
              onClick={() => choose("essential")}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-zinc-200 transition-colors hover:border-white/25 hover:bg-white/10"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => choose("all")}
              className="rounded-xl bg-[#c8ff5a] px-4 py-2.5 text-xs font-extrabold text-[#0e0618] transition-colors hover:bg-[#d7ff87]"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
