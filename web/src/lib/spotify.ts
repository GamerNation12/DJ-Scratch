import { verifyToken } from "@/lib/jwt";
import { sql } from "@/lib/db";

/** Exchange the stored refresh token for a user access token. Null = not linked/revoked. */
export async function getSpotifyAccessToken(userId: string): Promise<string | null> {
  try {
    const res = await sql`SELECT spotify_refresh_token FROM user_settings WHERE user_id = ${userId}`;
    const refresh_token = res[0]?.spotify_refresh_token;
    if (!refresh_token) return null;

    const auth_str = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth_str}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token,
      }),
    });

    if (!tokenRes.ok) return null; // invalid_grant etc. -> treat as not linked
    const data = await tokenRes.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

/** Authenticated user id from the site JWT, or null. */
export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  return user ? ((user as { id?: unknown }).id as string) || null : null;
}

/** Thin wrapper over the Spotify Web API. */
export async function spotifyFetch(accessToken: string, path: string, init?: RequestInit) {
  return fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}
