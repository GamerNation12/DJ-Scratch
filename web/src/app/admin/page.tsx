"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/app/providers";

// /admin is not a page anymore — the console lives in the user dashboard.
// This just forwards you to your own dashboard's Admin tab (or login).
export default function AdminRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    const name = session?.user?.name;
    if (name) {
      const username = name === "gamernation12" ? "GamerNation12" : name;
      router.replace(`/${username}?tab=admin`);
    } else {
      localStorage.setItem("postLoginRedirect", "/admin");
      window.location.href = "/api/auth/login";
    }
  }, [session, status, router]);

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <h1 className="text-xl font-bold animate-pulse text-indigo-400">Taking you to your dashboard...</h1>
    </div>
  );
}
