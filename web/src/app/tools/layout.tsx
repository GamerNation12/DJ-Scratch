import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Music Tools",
  description: "Free music tools: listening pace calculator, taste comparison, and whoknows artist stats for Last.fm listeners.",
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev/tools" },
  openGraph: {
    title: "DJ Scratch Music Tools",
    description: "Pace calculator, taste matcher, whoknows and more.",
    url: "https://dj-scratch.is-a-fullstack.dev/tools",
  },
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
