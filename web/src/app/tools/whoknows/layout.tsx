import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WhoKnows",
  description: "Who knows an artist best? Server-wide playcount rankings for any artist on Last.fm.",
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev/tools/whoknows" },
};

export default function WhoknowsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
