import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | DJ Scratch",
  description: "Terms of service for DJ Scratch.",
  openGraph: {
    title: "Terms of Service | DJ Scratch",
    description: "Terms of service for DJ Scratch.",
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
