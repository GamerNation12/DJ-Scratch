import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Taste Matcher",
  description: "Compare music taste with friends: shared artists, compatibility score, and discoveries.",
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev/tools/taste" },
};

export default function TasteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
