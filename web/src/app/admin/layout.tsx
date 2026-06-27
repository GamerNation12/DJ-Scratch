import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Panel | The Goats DJ",
  description: "Server administration panel for The Goats DJ.",
  openGraph: {
    title: "Admin Panel | The Goats DJ",
    description: "Server administration panel for The Goats DJ.",
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
