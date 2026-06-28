import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import Data | DJ Scratch",
  description: "Import your extended streaming history to DJ Scratch.",
  openGraph: {
    title: "Import Data | DJ Scratch",
    description: "Import your extended streaming history to DJ Scratch.",
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
