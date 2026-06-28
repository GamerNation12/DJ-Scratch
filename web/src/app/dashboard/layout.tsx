import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | DJ Scratch",
  description: "Manage your integration, preferences, and account data for DJ Scratch.",
  openGraph: {
    title: "Dashboard | DJ Scratch",
    description: "Manage your integration, preferences, and account data for DJ Scratch.",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
