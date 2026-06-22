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
        const payload = JSON.parse(atob(newToken.split(".")[1]));
        router.replace(`/${payload.name}`);
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
