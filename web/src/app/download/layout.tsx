import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download DJ Scratch",
  description:
    "Download DJ Scratch for Windows, Linux and Android. Track Last.fm and Spotify listening with music stats, recaps, crowns and streaks.",
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev/download" },
  openGraph: {
    title: "Download DJ Scratch",
    description: "DJ Scratch apps for Windows, Linux and Android — your music stats everywhere.",
    url: "https://dj-scratch.is-a-fullstack.dev/download",
  },
};

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
