"use client";

import { Suspense } from "react";
import MessagesContent from "@/components/MessagesContent";

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030712] flex items-center justify-center text-white">Loading...</div>}>
      <MessagesContent isEmbedded={false} />
    </Suspense>
  );
}
