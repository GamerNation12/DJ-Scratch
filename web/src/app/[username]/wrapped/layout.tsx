import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const name = decodeURIComponent(username || "");
  const canonical = `https://dj-scratch.is-a-fullstack.dev/${encodeURIComponent(name)}/wrapped`;
  const title = `${name}'s Wrapped | DJ Scratch`;
  const description = `Watch ${name}'s month in music as an auto-playing story: top artist, track, album, listening time, and discoveries.`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
    twitter: { card: "summary", title, description },
  };
}

export default function WrappedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
