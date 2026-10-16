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
  robots: { index: true, follow: true },
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

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "DJ Scratch",
      url: "https://dj-scratch.is-a-fullstack.dev",
    },
    {
      "@type": "SoftwareApplication",
      name: "DJ Scratch",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Discord",
      url: "https://dj-scratch.is-a-fullstack.dev",
      description:
        "Track, share, and analyze your music listening habits with DJ Scratch. Last.fm & Spotify stats, recaps, and community leaderboards.",
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
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