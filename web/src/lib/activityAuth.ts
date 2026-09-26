"use client";

/** Login flows that work both on the web and inside the Discord Activity.
 *
 * Inside an Activity (embedded iframe, detected via frame_id/instance_id or
 * being framed) top-level OAuth redirects are blocked by the Discord client —
 * Discord login goes through the Embedded App SDK handshake instead, and
 * Last.fm (which blocks iframing) opens in the user's real browser via
 * openExternalLink. Outside an Activity both fall back to plain redirects.
 */

export function isActivity(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("frame_id") || sp.has("instance_id")) return true;
  } catch {
    /* ignore */
  }
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin frame: assume embedded
  }
}

async function getSdk(clientId: string) {
  const { DiscordSDK } = await import("@discord/embedded-app-sdk");
  const sdk = new DiscordSDK(clientId);
  await sdk.ready();
  return sdk;
}

/** Discord login. Returns true when handled (activity), false when the
 *  caller should do the normal web redirect instead. */
export async function loginWithDiscord(): Promise<boolean> {
  if (!isActivity()) {
    window.location.href = "/api/auth/login";
    return true;
  }
  try {
    const cfg = await (await fetch("/api/config/client-id")).json();
    const clientId = cfg?.clientId;
    if (!clientId) throw new Error("no client id");
    const sdk = await getSdk(clientId);
    let code: string | null = null;
    try {
      const res = (await sdk.commands.authorize({
        client_id: clientId,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify", "email", "guilds"],
      })) as unknown as { code?: string };
      code = res?.code || null;
    } catch {
      // Silent auth failed (never authorized) — show the consent UI.
      const res = (await sdk.commands.authorize({
        client_id: clientId,
        response_type: "code",
        state: "",
        scope: ["identify", "email", "guilds"],
      })) as unknown as { code?: string };
      code = res?.code || null;
    }
    if (!code) throw new Error("no code");
    const res = await fetch("/api/auth/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
    if (!res.ok || !data?.token) {
      throw new Error(data?.error || "exchange failed");
    }
    try {
      localStorage.setItem("discord_jwt", data.token);
    } catch {
      /* ignore */
    }
    window.location.reload();
    return true;
  } catch (e) {
    console.error("Activity login failed:", e);
    return false;
  }
}

/** Last.fm login. Always lands in a real browser tab (Last.fm blocks
 *  iframes); in an Activity it opens externally, otherwise plain redirect. */
export async function loginWithLastfm(): Promise<void> {
  const url = "/api/auth/lastfm/login";
  if (!isActivity()) {
    window.location.href = url;
    return;
  }
  try {
    const cfg = await (await fetch("/api/config/client-id")).json();
    const clientId = cfg?.clientId;
    if (!clientId) throw new Error("no client id");
    const sdk = await getSdk(clientId);
    await sdk.commands.openExternalLink({ url: window.location.origin + url });
  } catch (e) {
    console.error("openExternalLink failed, falling back:", e);
    window.location.href = url;
  }
}
