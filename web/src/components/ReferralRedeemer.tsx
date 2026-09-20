"use client";

import { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { fetchApi } from "@/lib/fetchApi";
import { useSession } from "@/app/providers";

/** Global referral redeemer: runs on every page once authenticated.
 *
 * Profile invite links (?ref=CODE) stash the code for logged-out visitors.
 * After Discord login the user can land anywhere (dashboard, logging-in…),
 * so redemption lives here — not just on profile pages. Both sides earn
 * badges once the friend links Last.fm (bot sweep).
 */
export default function ReferralRedeemer() {
  const { status } = useSession();
  const doneRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || doneRef.current) return;
    let code: string | null = null;
    try {
      code = localStorage.getItem("dj_referral_code");
    } catch {
      code = null;
    }
    if (!code) return;
    doneRef.current = true;
    (async () => {
      try {
        const res = await fetchApi("/api/referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && (data as any)?.success) {
          try {
            localStorage.removeItem("dj_referral_code");
          } catch {
            /* ignore */
          }
          toast.success(`🎉 Invite from ${(data as any).sharer} counted! Link Last.fm so you both earn badges.`);
        } else if ((data as any)?.error) {
          // Own-link clicks are expected noise — stay quiet for those.
          if (!/own link/i.test(String((data as any).error))) {
            toast.error(String((data as any).error));
          } else {
            try {
              localStorage.removeItem("dj_referral_code");
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        doneRef.current = false; // offline — retry on next mount
      }
    })();
  }, [status]);

  return null;
}
