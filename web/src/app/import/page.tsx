"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ImportRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("discord_jwt");
    if (!token) {
      localStorage.setItem("postLoginRedirect", "/import");
      window.location.href = "/api/auth/login";
      return;
    }

    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      if (decoded && decoded.name) {
        const username = decoded.name === "gamernation12" ? "GamerNation12" : decoded.name;
        router.replace(`/${username}?tab=import`);
      } else {
        localStorage.setItem("postLoginRedirect", "/import");
        window.location.href = "/api/auth/login";
      }
    } catch (e) {
      localStorage.setItem("postLoginRedirect", "/import");
      window.location.href = "/api/auth/login";
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <h1 className="text-xl font-bold animate-pulse text-amber-500">Taking you to the import page...</h1>
    </div>
  );
}
