"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginCallbackInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Please wait while we securely connect your Last.fm account to Discord.");
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const discordId = searchParams.get("discord_id");
    const channelId = searchParams.get("channel_id");
    const messageId = searchParams.get("message_id");

    if (!token || !discordId) {
      setStatus("error");
      setMessage("Missing required parameters. Please try logging in again via Discord.");
      return;
    }

    const processLogin = async () => {
      try {
        let url = `https://dj-scratch.vercel.app/api/auth/lastfm/callback?token=${token}&discord_id=${discordId}`;
        if (channelId) url += `&channel_id=${channelId}`;
        if (messageId) url += `&message_id=${messageId}`;
        const res = await fetch(url);
        const data = await res.json();

        if (res.ok && data.success) {
          setStatus("success");
          setUsername(data.username);
        } else {
          setStatus("error");
          setMessage(data.error || "An unknown error occurred.");
        }
      } catch (err) {
        setStatus("error");
        setMessage("Failed to communicate with the authentication server. Please try again later.");
      }
    };

    processLogin();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-red-600/20 blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse pointer-events-none" />

      {/* Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-lg p-8 sm:p-12 rounded-3xl bg-gray-900/50 backdrop-blur-xl border border-gray-800/60 shadow-2xl transition-all duration-500 ease-out transform hover:scale-[1.02]">
        
        <div className="flex flex-col items-center text-center space-y-6">
          
          {/* Status Icon with Micro-animations */}
          <div className="relative h-24 w-24 flex items-center justify-center">
            {status === "loading" && (
              <>
                <div className="absolute inset-0 rounded-full border-t-4 border-l-4 border-red-500 animate-spin" />
                <div className="absolute inset-2 rounded-full border-b-4 border-r-4 border-blue-500 animate-[spin_1.5s_reverse_infinite]" />
                <span className="text-2xl animate-pulse">⏳</span>
              </>
            )}
            
            {status === "success" && (
              <div className="relative group">
                <div className="absolute inset-0 bg-green-500 rounded-full blur-md opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
                <div className="relative h-20 w-20 bg-gradient-to-tr from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg transform scale-110 transition-transform animate-[bounce_0.5s_ease-out]">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="relative">
                <div className="absolute inset-0 bg-red-500 rounded-full blur-md opacity-50" />
                <div className="relative h-20 w-20 bg-gradient-to-tr from-red-500 to-rose-700 rounded-full flex items-center justify-center shadow-lg transform scale-110">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Text Content */}
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              {status === "loading" && <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-blue-500">Connecting...</span>}
              {status === "success" && <span className="text-green-400">Account Linked!</span>}
              {status === "error" && <span className="text-red-400">Authentication Failed</span>}
            </h1>
            
            <p className="text-gray-400 text-lg font-medium">
              {status === "success" ? (
                <>
                  Your Last.fm account <strong className="text-white bg-white/10 px-2 py-1 rounded-md ml-1">{username}</strong> has been successfully linked.
                  <br />
                  <span className="block mt-4 text-sm text-gray-500">You may now safely close this tab and return to Discord.</span>
                </>
              ) : (
                message
              )}
            </p>
          </div>

          {/* Interactive Button (Optional return to Discord/Retry) */}
          {status === "error" && (
            <button 
              onClick={() => window.close()} 
              className="mt-4 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors duration-200 shadow-md"
            >
              Close Window
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

export default function LoginCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="relative h-24 w-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-t-4 border-l-4 border-red-500 animate-spin" />
          <div className="absolute inset-2 rounded-full border-b-4 border-r-4 border-blue-500 animate-[spin_1.5s_reverse_infinite]" />
          <span className="text-2xl animate-pulse">⏳</span>
        </div>
      </div>
    }>
      <LoginCallbackInner />
    </Suspense>
  );
}
