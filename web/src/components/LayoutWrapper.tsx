"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActivity = pathname.startsWith('/activity');

  if (isActivity) {
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
