import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Picks",
  description: "Every day the DJ Scratch community spotlights a song, a member, and an album. See today's picks.",
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev/community" },
  openGraph: {
    title: "DJ Scratch Community Picks",
    description: "Daily song, member, and album spotlights from the community.",
    url: "https://dj-scratch.is-a-fullstack.dev/community",
  },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
