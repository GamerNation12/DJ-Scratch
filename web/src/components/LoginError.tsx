"use client";

import { useSearchParams } from "next/navigation";

export default function LoginError() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const detailsParam = searchParams.get("details");

  if (!errorParam) return null;

  return (
    <div className="bg-red-500/20 border-2 border-red-500/60 text-red-200 px-6 py-4 rounded-2xl mb-8 max-w-2xl backdrop-blur-md animate-fade-in-up">
      <h2 className="text-xl font-bold mb-2">Login Failed ({errorParam})</h2>
      <p className="text-sm opacity-80">
        {detailsParam || "An unknown error occurred during the Discord OAuth process."}
      </p>
    </div>
  );
}
