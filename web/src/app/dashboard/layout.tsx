import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | The Goats DJ",
  description: "Manage your integration, preferences, and account data for The Goats DJ.",
  openGraph: {
    title: "Dashboard | The Goats DJ",
    description: "Manage your integration, preferences, and account data for The Goats DJ.",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
