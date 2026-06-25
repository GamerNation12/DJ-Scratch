"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("discord_jwt");
    if (!token) {
      localStorage.setItem("postLoginRedirect", "/dashboard");
      window.location.href = "/api/auth/login";
      return;
    }

    try {
      const base64Str = token.split('.')[1].replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(atob(base64Str));
      if (decoded && decoded.name) {
        const username = decoded.name === "gamernation12" ? "GamerNation12" : decoded.name;
        router.replace(`/${username}`);
      } else {
        localStorage.setItem("postLoginRedirect", "/dashboard");
        window.location.href = "/api/auth/login";
      }
    } catch (e) {
      localStorage.setItem("postLoginRedirect", "/dashboard");
      window.location.href = "/api/auth/login";
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <h1 className="text-xl font-bold animate-pulse">Taking you to your dashboard...</h1>
    </div>
  );
}
