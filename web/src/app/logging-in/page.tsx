"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoggingIn() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("token=")) {
      const newToken = hash.split("token=")[1].split("&")[0];

      const decode = (t: string | null) => {
        try {
          if (!t) return null;
          const b64 = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
          return JSON.parse(atob(b64));
        } catch {
          return null;
        }
      };

      // Discord and Last.fm logins share one session key. A fresh Discord
      // login always wins, but a Last.fm login must NOT clobber a valid
      // Discord session for the same user (Discord tokens carry the email
      // and avatar the Last.fm one lacks).
      const stored = localStorage.getItem("discord_jwt");
      const storedPayload = decode(stored);
      const newPayload = decode(newToken);
      const storedUsable =
        !!storedPayload?.id &&
        (!storedPayload.exp || storedPayload.exp * 1000 > Date.now());
      const keepStored =
        !!stored &&
        storedUsable &&
        !newPayload?.discord_name && // incoming login came from Last.fm...
        !!storedPayload?.discord_name && // ...and we're already on Discord...
        String(storedPayload.id) === String(newPayload?.id); // ...as the same user.

      const effectiveToken = keepStored && stored ? stored : newToken;
      localStorage.setItem("discord_jwt", effectiveToken);

      // Decode the token to find the username to redirect to
      try {
        const decoded = decode(effectiveToken);
        if (!decoded || !decoded.name) {
          router.replace("/");
          return;
        }
        const username = decoded.name === "gamernation12" ? "GamerNation12" : decoded.name;
        
        const redirect = localStorage.getItem("postLoginRedirect");
        if (redirect) {
          localStorage.removeItem("postLoginRedirect");
          if (redirect === "/dashboard") {
            router.replace(`/${username}`);
          } else if (redirect === "/import") {
            router.replace(`/${username}?tab=import`);
          } else {
            router.replace(redirect);
          }
        } else {
          router.replace(`/${username}`);
        }
      } catch (e) {
        router.replace("/");
      }
    } else {
      router.replace("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <h1 className="text-xl font-bold animate-pulse">Logging you in...</h1>
    </div>
  );
}
