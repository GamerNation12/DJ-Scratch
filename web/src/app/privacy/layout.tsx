import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | DJ Scratch",
  description: "Privacy policy and data handling for DJ Scratch.",
  openGraph: {
    title: "Privacy Policy | DJ Scratch",
    description: "Privacy policy and data handling for DJ Scratch.",
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
