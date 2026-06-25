"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoggingIn() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("token=")) {
      const newToken = hash.split("token=")[1].split("&")[0];
      localStorage.setItem("discord_jwt", newToken);
      
      // Decode the token to find the username to redirect to
      try {
        const base64Str = newToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(base64Str));
        const username = payload.name === "gamernation12" ? "GamerNation12" : payload.name;
        
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
