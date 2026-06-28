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
  title: "DJ Scratch | Your Ultimate Music Stats Bot",
  description: "Track, share, and analyze your music listening habits with DJ Scratch. The most aesthetic and feature-rich Last.fm & Spotify Discord bot.",
  openGraph: {
    title: "DJ Scratch | Your Ultimate Music Stats Bot",
    description: "Track, share, and analyze your music listening habits with DJ Scratch. The most aesthetic and feature-rich Last.fm & Spotify Discord bot.",
    url: "https://dj-scratch.vercel.app",
    siteName: "DJ Scratch",
    images: [
      {
        url: "https://dj-scratch.vercel.app/logo.png",
        width: 800,
        height: 800,
        alt: "DJ Scratch Logo",
      }
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DJ Scratch | Your Ultimate Music Stats Bot",
    description: "Track, share, and analyze your music listening habits with DJ Scratch. The most aesthetic and feature-rich Last.fm & Spotify Discord bot.",
    images: ["https://dj-scratch.vercel.app/logo.png"],
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
