import type { Metadata } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dj-scratch.is-a-fullstack.dev"),
  title: {
    default: "DJ Scratch | Your Ultimate Music Stats Bot",
    template: "%s | DJ Scratch",
  },
  description: "Track, share, and analyze your music listening habits with DJ Scratch. The most aesthetic and feature-rich Last.fm & Spotify Discord bot.",
  keywords: ["DJ Scratch", "Discord music bot", "Last.fm stats", "Spotify stats", "music stats tracker", "stats.fm alternative", "scrobble tracker", "music recap", "listening history"],
  authors: [{ name: "DJ Scratch" }],
  creator: "DJ Scratch",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev" },
  openGraph: {
    title: "DJ Scratch | Your Ultimate Music Stats Bot",
    description: "Track, share, and analyze your music listening habits with DJ Scratch. The most aesthetic and feature-rich Last.fm & Spotify Discord bot.",
    url: "https://dj-scratch.is-a-fullstack.dev",
    siteName: "DJ Scratch",
      images: [
        {
          url: "https://dj-scratch.is-a-fullstack.dev/logo.png?v=2",
          width: 1024,
          height: 1024,
          alt: "DJ Scratch Logo",
        },
      ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DJ Scratch | Your Ultimate Music Stats Bot",
    description: "Track, share, and analyze your music listening habits with DJ Scratch. The most aesthetic and feature-rich Last.fm & Spotify Discord bot.",
    images: ["https://dj-scratch.is-a-fullstack.dev/logo.png?v=2"],
  },
  icons: {
    icon: "/icon.png?v=2",
  },
};

const SITE_URL = "https://dj-scratch.is-a-fullstack.dev";
const DISCORD_URL = "https://discord.gg/MT6d7jh3rv";

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "DJ Scratch",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png?v=2`,
      description:
        "DJ Scratch is a free Last.fm and Spotify stats Discord bot with now-playing cards, crowns, leaderboards and recaps.",
      sameAs: [
        DISCORD_URL,
        "https://github.com/GamerNation12/DJ-Scratch",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "DJ Scratch",
      alternateName: ["DJ Scratch Bot", "DJ Scratch Music Stats"],
      url: SITE_URL,
      description:
        "Track, share, and analyze your music listening habits with DJ Scratch, the Last.fm & Spotify stats Discord bot.",
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "DJ Scratch",
      applicationCategory: "MultimediaApplication",
      applicationSubCategory: "Music Stats Discord Bot",
      operatingSystem: "Discord",
      url: SITE_URL,
      image: `${SITE_URL}/logo.png?v=2`,
      description:
        "Track, share, and analyze your music listening habits with DJ Scratch. Last.fm & Spotify stats, recaps, crowns and community leaderboards.",
      featureList: [
        "Last.fm and Spotify now-playing cards",
        "Server crowns and leaderboards",
        "Weekly and monthly listening recaps",
        "Shareable music stat cards",
        "Listening history import",
        "Private mode",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

import LayoutWrapper from "@/components/LayoutWrapper";
import ReferralRedeemer from "@/components/ReferralRedeemer";
import ActivityLoginNotice from "@/components/ActivityLoginNotice";
import { headers } from "next/headers";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = await headers();
  const isDiscordActivity = h.get('x-discord-activity') === 'true';
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
        />
        <Providers>
          <ReferralRedeemer />
          <ActivityLoginNotice />
          <Toaster 
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#18181b',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
              },
            }}
          />
          {isDiscordActivity ? (
            children
          ) : (
            <LayoutWrapper>
              {children}
            </LayoutWrapper>
          )}
        </Providers>
      </body>
    </html>
  );
}