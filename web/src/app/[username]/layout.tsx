import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  // Decode the URI component in case the username has spaces or special characters
  const username = decodeURIComponent(resolvedParams.username);
  
  return {
    title: `${username}'s Profile | DJ Scratch`,
    description: `Check out ${username}'s music profile, top artists, and recent tracks on DJ Scratch.`,
    openGraph: {
      title: `${username}'s Profile | DJ Scratch`,
      description: `Check out ${username}'s music profile, top artists, and recent tracks on DJ Scratch.`,
      url: `https://dj-scratch.vercel.app/${encodeURIComponent(username)}`,
      siteName: "DJ Scratch",
      images: [
        {
          url: "https://dj-scratch.vercel.app/logo.png",
          width: 1024,
          height: 1024,
          alt: `${username}'s DJ Scratch profile`,
        },
      ],
      locale: "en_US",
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${username}'s Profile | DJ Scratch`,
      description: `Check out ${username}'s music profile, top artists, and recent tracks on DJ Scratch.`,
      images: ["https://dj-scratch.vercel.app/logo.png"],
    },
  };
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
