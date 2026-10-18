import { NextResponse } from "next/server";
import { ProfilePageClient } from "@/components/ProfilePageClient";

export const revalidate = 60;

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await params;
  const usernameParam = decodeURIComponent(rawUsername || "");

  // Fetch profile data from the API on the server
  let profileData: any = null;
  let rhythmData: any = null;
  let recapData: any = null;

  try {
    const profileRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "https://dj-scratch.is-a-fullstack.dev"}/api/u/${encodeURIComponent(usernameParam)}`,
      { cache: "no-store" },
    );
    if (profileRes.ok) {
      profileData = await profileRes.json();
    }
  } catch {
    // profile fetch failed
  }

  try {
    const rhythmRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "https://dj-scratch.is-a-fullstack.dev"}/api/u/${encodeURIComponent(usernameParam)}?period=7day`,
      { cache: "no-store" },
    );
    if (rhythmRes.ok) {
      rhythmData = await rhythmRes.json();
    }
  } catch {
    // rhythm fetch failed
  }

  try {
    const recapRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "https://dj-scratch.is-a-fullstack.dev"}/api/recap?user=${encodeURIComponent(usernameParam)}`,
      { cache: "no-store" },
    );
    if (recapRes.ok) {
      recapData = await recapRes.json();
    }
  } catch {
    // recap fetch failed
  }

  if (!profileData) {
    // Fallback: try using Discord user ID if username lookup fails
    // When logged in as the user, we can fall back to their ID
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e0618] text-white p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Profile Not Found</h1>
          <p className="text-zinc-400">
            The user <strong>{usernameParam}</strong> was not found.
          </p>
          <a href="/" className="text-indigo-400 hover:text-indigo-400 underline">
            {"← Back to Home"}
          </a>
        </div>
      </div>
    );
  }

  return (
    <ProfilePageClient
      username={usernameParam}
      profileData={profileData}
      rhythmData={rhythmData}
      recapData={recapData}
    />
  );
}