"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { DiscordSDK } from "@discord/embedded-app-sdk";
import ActivityDMUI from "@/components/ActivityDMUI";

const CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "1521582398188290049";
// Initialize outside React to ensure immediate handshake!
const discordSdk = new DiscordSDK(CLIENT_ID);
let isSetupStarted = false;

export default function ActivityDMPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Initializing SDK...");

  useEffect(() => {
    if (isSetupStarted) return;
    isSetupStarted = true;

    async function setupDiscordSdk() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const frameId = urlParams.get('frame_id') || 'MISSING';
        
        setStatus(`Waiting for SDK ready event (Client: ${CLIENT_ID}, Frame: ${frameId})...`);
        
        // Add a timeout so it doesn't hang forever
        const readyPromise = discordSdk.ready();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout waiting for Discord SDK ready event. Client ID might be incorrect or Discord app is not responding.")), 15000)
        );
        
        await Promise.race([readyPromise, timeoutPromise]);

        setStatus("Prompting for authorization...");
        const { code } = await discordSdk.commands.authorize({
          client_id: CLIENT_ID,
          response_type: "code",
          state: "",
          prompt: "none",
          scope: ["identify", "guilds", "email"],
        });

        setStatus("Exchanging code for token...");
        const response = await fetch("/api/auth/activity", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed to authenticate");
        }

        setStatus("Saving token...");
        localStorage.setItem("discord_jwt", data.token);
        setIsAuthenticated(true);

      } catch (err: any) {
        console.error("Discord SDK Setup Error:", err);
        setError(err.message || String(err));
      }
    }

    setupDiscordSdk();
  }, []);

  if (error) {
    return (
      <div className="w-screen h-screen bg-[#313338] flex flex-col items-center justify-center text-white p-4">
        <h2 className="text-xl font-bold text-red-500 mb-2">Authentication Failed</h2>
        <p className="text-[#dbdee1] font-mono text-xs max-w-lg text-center break-words">{error}</p>
        <p className="text-zinc-500 text-xs mt-4">Last Status: {status}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-screen h-screen bg-[#09090b] flex flex-col items-center justify-center text-white p-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6 shadow-lg shadow-indigo-500/20"></div>
        <p className="text-zinc-400 font-bold tracking-widest uppercase text-sm mb-2">Authenticating</p>
        <p className="text-indigo-400/80 font-mono text-xs">{status}</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="w-screen h-screen bg-[#313338] flex items-center justify-center text-white">Loading...</div>}>
      <ActivityDMUI />
    </Suspense>
  );
}
