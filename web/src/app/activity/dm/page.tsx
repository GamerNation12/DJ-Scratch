"use client";

import { useEffect, useState, Suspense } from "react";
import { DiscordSDK } from "@discord/embedded-app-sdk";
import MessagesContent from "@/components/MessagesContent";

export default function ActivityDMPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function setupDiscordSdk() {
      try {
        // Fetch Client ID
        const clientIdRes = await fetch('/api/config/client-id');
        const { clientId } = await clientIdRes.json();
        
        if (!clientId) {
          throw new Error("Client ID not found");
        }

        const discordSdk = new DiscordSDK(clientId);
        await discordSdk.ready();

        const { code } = await discordSdk.commands.authorize({
          client_id: clientId,
          response_type: "code",
          state: "",
          prompt: "none",
          scope: ["identify", "guilds", "email"],
        });

        // Exchange code for token securely on our backend
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

        // Store the returned JWT for the Messages component to use
        localStorage.setItem("discord_jwt", data.token);
        setIsAuthenticated(true);

      } catch (err: any) {
        console.error("Discord SDK Setup Error:", err);
        setError(err.message || "Failed to initialize Discord Activity");
      }
    }

    setupDiscordSdk();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white p-4">
        <h2 className="text-xl font-bold text-red-500 mb-2">Authentication Failed</h2>
        <p className="text-zinc-400">{error}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white p-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-400 font-medium">Authenticating with Discord...</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">Loading...</div>}>
      <MessagesContent isEmbedded={true} />
    </Suspense>
  );
}
