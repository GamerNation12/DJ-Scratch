import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Standards | DJ Scratch",
  description: "Community standards for DJ Scratch.",
  openGraph: {
    title: "Community Standards | DJ Scratch",
    description: "Community standards for DJ Scratch.",
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
