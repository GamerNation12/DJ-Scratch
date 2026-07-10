"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { useEffect, useState } from "react";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isDiscordIframe, setIsDiscordIframe] = useState(false);
  
  useEffect(() => {
    const search = window.location.search;
    if (search.includes('frame_id=') || search.includes('instance_id=')) {
      setIsDiscordIframe(true);
    }
  }, []);

  const isActivityRoute = pathname.startsWith('/activity');

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
