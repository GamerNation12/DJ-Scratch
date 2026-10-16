import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with DJ Scratch: setup guides, Last.fm linking, imports, and direct support from the community.",
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev/support" },
  openGraph: {
    title: "DJ Scratch Support",
    description: "Setup guides and help for DJ Scratch.",
    url: "https://dj-scratch.is-a-fullstack.dev/support",
  },
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
