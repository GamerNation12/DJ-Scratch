"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginWithDiscord } from "@/lib/activityAuth";

export default function ImportRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("discord_jwt");
    if (!token) {
      localStorage.setItem("postLoginRedirect", "/import");
      void loginWithDiscord();
      return;
    }

    try {
      const base64Str = token.split('.')[1].replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(atob(base64Str));
      if (decoded && decoded.name) {
        const username = decoded.name === "gamernation12" ? "GamerNation12" : decoded.name;
        router.replace(`/${username}?tab=import`);
      } else {
        localStorage.setItem("postLoginRedirect", "/import");
        void loginWithDiscord();
      }
    } catch (e) {
      localStorage.setItem("postLoginRedirect", "/import");
      void loginWithDiscord();
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0e0618] flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <h1 className="text-xl font-bold animate-pulse text-amber-500">Taking you to the import page...</h1>
    </div>
  );
}
