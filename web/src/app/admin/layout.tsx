import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Panel | DJ Scratch",
  description: "Server administration panel for DJ Scratch.",
  openGraph: {
    title: "Admin Panel | DJ Scratch",
    description: "Server administration panel for DJ Scratch.",
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
