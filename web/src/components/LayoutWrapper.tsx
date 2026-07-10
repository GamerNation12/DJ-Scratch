"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { useEffect, useState } from "react";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Discord proxies the request, so the browser URL might be '/' while serving '/activity/dm'.
  // The most reliable way to detect the Discord Activity is checking for frame_id or instance_id.
  const isActivityRoute = pathname.startsWith('/activity');
  const isDiscordIframe = searchParams.has('frame_id') || searchParams.has('instance_id');

  if (isActivityRoute || isDiscordIframe) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen">
        {children}
      </div>
      <Footer />
    </>
  );
}
