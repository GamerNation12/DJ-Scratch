import type { Metadata } from "next";
import HomeClient from "@/components/HomeClient";
import { FAQ_ITEMS } from "@/lib/faq";

const BASE = "https://dj-scratch.is-a-fullstack.dev";

export const metadata: Metadata = {
  title: { absolute: "DJ Scratch | Last.fm & Spotify Stats Discord Bot" },
  description:
    "DJ Scratch is a free Last.fm & Spotify stats Discord bot. See now-playing cards, server crowns, leaderboards, weekly recaps and shareable music stats without leaving Discord.",
  alternates: { canonical: BASE },
  openGraph: {
    title: "DJ Scratch | Last.fm & Spotify Stats Discord Bot",
    description:
      "Free Last.fm & Spotify stats Discord bot with now-playing cards, server crowns, leaderboards, recaps and shareable music stats.",
    url: BASE,
    siteName: "DJ Scratch",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: `${BASE}/logo.png?v=2`,
        width: 1024,
        height: 1024,
        alt: "DJ Scratch Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DJ Scratch | Last.fm & Spotify Stats Discord Bot",
    description:
      "Free Last.fm & Spotify stats Discord bot with now-playing cards, server crowns, leaderboards, recaps and shareable music stats.",
    images: [`${BASE}/logo.png?v=2`],
  },
};

// Mirrors the visible FAQ section in HomeClient so the rich result matches
// the page content.
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(FAQ_JSON_LD).replace(/</g, "\\u003c"),
        }}
      />
      <HomeClient />
    </>
  );
}
