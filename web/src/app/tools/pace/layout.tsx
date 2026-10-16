import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pace Calculator",
  description: "Will you hit your scrobble goal? Pace calculator for Last.fm listeners with daily targets.",
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev/tools/pace" },
};

export default function PaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
