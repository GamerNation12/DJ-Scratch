import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | The Goats DJ",
  description: "Terms of service for The Goats DJ.",
  openGraph: {
    title: "Terms of Service | The Goats DJ",
    description: "Terms of service for The Goats DJ.",
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
