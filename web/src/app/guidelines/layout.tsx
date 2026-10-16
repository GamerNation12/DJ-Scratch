import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description: "DJ Scratch community standards: how to keep charts, spotlights, and discussions fair for everyone.",
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev/guidelines" },
};

export default function GuidelinesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
