import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard | DJ Scratch",
  description: "Check out the top scrobblers on the global leaderboard.",
  openGraph: {
    title: "Leaderboard | DJ Scratch",
    description: "Check out the top scrobblers on the global leaderboard.",
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
