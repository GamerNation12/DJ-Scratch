"use client";

import { useState } from "react";
import { useSession } from "@/app/providers";
import { isActivity, loginWithDiscord, loginWithLastfm } from "@/lib/activityAuth";

/** Shown only inside the Discord Activity for logged-out visitors:
 *  log into the website first, then the Activity connects instantly. */
export default function ActivityLoginNotice() {
  const { status } = useSession();
  // Evaluated once (SSR-safe: isActivity() returns false without window).
  const [inActivity] = useState(() => isActivity());
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState<"discord" | "lastfm" | null>(null);

  if (!inActivity || status !== "unauthenticated" || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-xs p-4 rounded-2xl bg-[#170b28]/95 backdrop-blur-xl border-2 border-fuchsia-500/30 shadow-2xl shadow-fuchsia-950/50">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm font-extrabold text-white">Playing in the Activity? 🎮</div>
        <button
          onClick={() => setDismissed(true)}
          className="text-zinc-500 hover:text-white text-sm leading-none px-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      <p className="text-xs text-zinc-300 leading-relaxed mb-3">
        Log into the <span className="font-bold text-white">website first</span>, then log in
        here — Discord connects instantly. Last.fm opens in your browser (it can&apos;t
        log in inside the Activity).
      </p>
      <div className="flex gap-2">
        <button
          disabled={busy !== null}
          onClick={async () => {
            setBusy("discord");
            try {
              await loginWithDiscord();
            } finally {
              setBusy(null);
            }
          }}
          className="flex-1 px-3 py-2 text-xs font-bold text-white bg-[#5865F2] hover:bg-[#4752C4] rounded-xl transition-all disabled:opacity-60"
        >
          {busy === "discord" ? "Connecting…" : "Login with Discord"}
        </button>
        <button
          disabled={busy !== null}
          onClick={async () => {
            setBusy("lastfm");
            try {
              await loginWithLastfm();
            } finally {
              setBusy(null);
            }
          }}
          className="flex-1 px-3 py-2 text-xs font-bold text-white bg-[#D51007] hover:bg-[#B00C05] rounded-xl transition-all disabled:opacity-60"
        >
          {busy === "lastfm" ? "Opening…" : "Last.fm"}
        </button>
      </div>
    </div>
  );
}
