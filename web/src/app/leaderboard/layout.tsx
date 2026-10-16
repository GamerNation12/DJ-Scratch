import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Top DJ Scratch listeners ranked by scrobbles. See who listens the most across the community.",
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev/leaderboard" },
  openGraph: {
    title: "DJ Scratch Leaderboard",
    description: "Top listeners ranked by scrobbles.",
    url: "https://dj-scratch.is-a-fullstack.dev/leaderboard",
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
