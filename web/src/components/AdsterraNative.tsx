"use client";

import { useEffect, useRef } from "react";
import { useCookieConsent } from "@/lib/cookieConsent";

// Adsterra Native Banner (JSAsync). The loader script has to run after the
// container exists, so it is injected on mount instead of being server-rendered.
const ADSTERRA_NATIVE_SRC =
  "https://bauval.org/21/426c897619457b96022d72c7d7bb9133";
const ADSTERRA_NATIVE_CONTAINER = "container-426c897619457b96022d72c7d7bb9133";

export default function AdsterraNative() {
  const hostRef = useRef<HTMLDivElement>(null);
  const { consent, ready } = useCookieConsent();

  useEffect(() => {
    if (!ready || consent !== "all") return;

    const host = hostRef.current;
    if (!host) return;

    const container = host.querySelector<HTMLDivElement>(
      `#${ADSTERRA_NATIVE_CONTAINER}`
    );
    if (!container) return;

    // Avoid duplicating the loader during React's development double-mount.
    container.innerHTML = "";

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = ADSTERRA_NATIVE_SRC;
    host.appendChild(script);

    return () => {
      script.remove();
      container.innerHTML = "";
    };
  }, [consent, ready]);

  if (!ready || consent !== "all") return null;

  return (
    <div className="w-full">
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Advertisement
      </p>
      <div ref={hostRef} className="w-full min-h-[120px]">
        <div id={ADSTERRA_NATIVE_CONTAINER} />
      </div>
    </div>
  );
}
