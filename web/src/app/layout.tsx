import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Goats DJ | Your Ultimate Music Stats Bot",
  description: "Track, share, and analyze your music listening habits with The Goats DJ. The most aesthetic and feature-rich Last.fm & Spotify Discord bot.",
  openGraph: {
    title: "The Goats DJ | Your Ultimate Music Stats Bot",
    description: "Track, share, and analyze your music listening habits with The Goats DJ. The most aesthetic and feature-rich Last.fm & Spotify Discord bot.",
    url: "https://the-goats-dj.vercel.app",
    siteName: "The Goats DJ",
    images: [
      {
        url: "https://the-goats-dj.vercel.app/logo.png",
        width: 800,
        height: 800,
        alt: "The Goats DJ Logo",
      }
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Goats DJ | Your Ultimate Music Stats Bot",
    description: "Track, share, and analyze your music listening habits with The Goats DJ. The most aesthetic and feature-rich Last.fm & Spotify Discord bot.",
    images: ["https://the-goats-dj.vercel.app/logo.png"],
  },
  icons: {
    icon: "/api/icon?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
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
          <Navbar />
          <div className="pt-16 min-h-screen">
            {children}
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
