import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | The Goats DJ",
  description: "Privacy policy and data handling for The Goats DJ.",
  openGraph: {
    title: "Privacy Policy | The Goats DJ",
    description: "Privacy policy and data handling for The Goats DJ.",
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
