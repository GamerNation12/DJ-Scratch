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
