"use client";

import { useEffect, useMemo, useState } from "react";
import { useCookieConsent } from "@/lib/cookieConsent";

type AdsterraBannerProps = {
  adKey: string;
  width: number;
  height: number;
  className?: string;
  showOn?: "mobile" | "desktop";
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

// Adsterra's default banner code uses `document.write`, which cannot be
// injected into a hydrated React page. Rendering it in a same-origin
// `srcdoc` iframe keeps document.write scoped to the ad document.
export default function AdsterraBanner({
  adKey,
  width,
  height,
  className = "",
  showOn,
}: AdsterraBannerProps) {
  const { consent, ready } = useCookieConsent();
  const mediaQuery =
    showOn === "mobile"
      ? "(max-width: 1023px)"
      : showOn === "desktop"
        ? "(min-width: 1024px)"
        : "(min-width: 0px)";
  const matches = useMediaQuery(mediaQuery);
  const srcDoc = useMemo(
    () => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; overflow: hidden; background: transparent; }
    </style>
  </head>
  <body>
    <script>
      atOptions = {
        'key' : '${adKey}',
        'format' : 'iframe',
        'height' : ${height},
        'width' : ${width},
        'params' : {}
      };
    </script>
    <script src="https://bauval.org/22/${adKey}"></script>
  </body>
</html>`,
    [adKey, width, height]
  );

  if (!ready || consent !== "all" || !matches) return null;

  return (
    <div className={className}>
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Advertisement
      </p>
      <iframe
        title={`Advertisement ${width}x${height}`}
        width={width}
        height={height}
        srcDoc={srcDoc}
        scrolling="no"
        frameBorder={0}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
        className="max-w-full"
      />
    </div>
  );
}
