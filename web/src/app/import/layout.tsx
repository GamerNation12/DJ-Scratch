import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import Data | The Goats DJ",
  description: "Import your extended streaming history to The Goats DJ.",
  openGraph: {
    title: "Import Data | The Goats DJ",
    description: "Import your extended streaming history to The Goats DJ.",
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
