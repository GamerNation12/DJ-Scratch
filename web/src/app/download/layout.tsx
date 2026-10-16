import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download DJ Scratch",
  description: "Download DJ Scratch for desktop (Windows) and Android. Track your Last.fm and Spotify listening with music stats, recaps, and streaks.",
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev/download" },
  openGraph: {
    title: "Download DJ Scratch",
    description: "DJ Scratch apps for Windows and Android — your music stats everywhere.",
    url: "https://dj-scratch.is-a-fullstack.dev/download",
  },
};

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
