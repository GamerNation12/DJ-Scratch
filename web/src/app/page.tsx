"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import JSZip from "jszip";

export default function Home() {
  const { data: session, status } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [fmMode, setFmMode] = useState<"compact" | "full">("full");
  const [showFeatures, setShowFeatures] = useState<boolean>(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  useEffect(() => {
    if (session) {
      fetch("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            if (data.fmMode) setFmMode(data.fmMode);
            if (data.showFeatures !== undefined) setShowFeatures(data.showFeatures);
          }
        })
        .catch((err) => console.error("Error fetching settings:", err));
    }
  }, [session]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">The Goats DJ</h1>
        <p className="text-zinc-400 mb-8 text-center max-w-md">Login with Discord to import your Spotify streaming history directly to the bot's database.</p>
        <button
          onClick={() => signIn("discord")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-full transition-all duration-200 shadow-lg shadow-indigo-500/30 cursor-pointer"
        >
          Login with Discord
        </button>
      </div>
    );
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setMessage("Reading file...");

    try {
      let tracks: any[] = [];
      
      if (file.name.endsWith(".zip")) {
        setMessage("Extracting ZIP file...");
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);
        
        // Find all JSON files that look like Spotify history
        for (const [filename, fileData] of Object.entries(loadedZip.files)) {
          if (!fileData.dir && filename.endsWith(".json") && (filename.includes("StreamingHistory") || filename.includes("endsong") || filename.includes("Streaming_History"))) {
            const content = await fileData.async("string");
            try {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed)) {
                tracks = tracks.concat(parsed);
              }
            } catch (err) {
              console.error(`Skipping invalid JSON in zip: ${filename}`);
            }
          }
        }
      } else if (file.name.endsWith(".json")) {
        const text = await file.text();
        tracks = JSON.parse(text);
      } else {
        throw new Error("Invalid file type.");
      }

      if (!Array.isArray(tracks) || tracks.length === 0) {
        throw new Error("No valid tracks found.");
      }

      // Basic Validation Check: Ensure it looks like Spotify data
      const sample = tracks[0];
      const isSpotifyData = sample.hasOwnProperty("trackName") || sample.hasOwnProperty("master_metadata_track_name");
      if (!isSpotifyData) {
         throw new Error("File does not appear to be valid Spotify data.");
      }
      
      setMessage(`Found ${tracks.length.toLocaleString()} tracks. Uploading to website...`);
      
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tracks),
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessage(data.message || "Upload complete! The bot will DM you when the database import is fully finished.");
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to upload to the server.");
      }
    } catch (error: any) {
      console.error(error);
      setMessage(error.message || "Error parsing or uploading file. Make sure it's a valid Spotify JSON or ZIP file.");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateFmMode = async (mode: "compact" | "full") => {
    setUpdatingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fmMode: mode }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fmMode) setFmMode(data.fmMode);
      }
    } catch (err) {
      console.error("Error updating settings:", err);
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleToggleFeatures = async () => {
    const newValue = !showFeatures;
    setShowFeatures(newValue); // Optimistic update
    setUpdatingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showFeatures: newValue }),
      });
      if (!res.ok) {
        // Revert on failure
        setShowFeatures(!newValue);
      }
    } catch (err) {
      console.error("Error updating feature settings:", err);
      setShowFeatures(!newValue);
    } finally {
      setUpdatingSettings(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4 relative overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px]" />

      <div className="absolute top-6 right-6 flex items-center gap-4 z-10">
        <span className="text-zinc-400">Logged in as <strong className="text-white">{session.user?.name}</strong></span>
        <button onClick={() => signOut()} className="text-sm bg-zinc-800 hover:bg-zinc-700 py-2 px-4 rounded-md transition-colors cursor-pointer">Sign Out</button>
      </div>

      <div className="max-w-5xl w-full z-10 mt-16 mb-8 text-center md:text-left">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent mb-2">The Goats DJ Dashboard</h1>
        <p className="text-zinc-400">Manage your profile, toggle Discord layouts, and sync your music history.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full z-10">
        {/* Left Column: Import */}
        <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-8 shadow-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">📥 Import History</h2>
            <p className="text-zinc-400 text-sm mb-6">Select your Spotify `my_spotify_data.zip` or a `StreamingHistory.json` file to upload to your profile.</p>

            <form onSubmit={handleUpload} className="flex flex-col gap-6">
              <div className="border-2 border-dashed border-zinc-700 hover:border-emerald-500/50 rounded-xl p-8 text-center hover:bg-zinc-800/20 transition-all duration-300 cursor-pointer relative">
                <input
                  type="file"
                  accept=".json,.zip"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                {file ? (
                  <span className="text-emerald-400 font-medium">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-3xl text-zinc-600">📂</span>
                    <span className="text-zinc-500">Click or drag your ZIP or JSON file here</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!file || uploading}
                className="bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-600/10"
              >
                {uploading ? "Uploading..." : "Start Import"}
              </button>
            </form>
          </div>

          {message && (
            <div className="mt-6 p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 text-center">
              <p className="text-zinc-300 font-mono text-xs leading-relaxed">{message}</p>
            </div>
          )}
        </div>

        {/* Right Column: Settings */}
        <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-8 shadow-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">⚙️ User Settings</h2>
            <p className="text-zinc-400 text-sm mb-8">Customize your bot experience and default display modes.</p>

            <div className="flex flex-col gap-6">
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">Default /fm Display Layout</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleUpdateFmMode("compact")}
                    disabled={updatingSettings}
                    className={`py-4 px-4 rounded-xl font-medium border text-center transition-all duration-200 cursor-pointer ${
                      fmMode === "compact"
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/5"
                        : "bg-zinc-800/40 border-zinc-700/50 hover:bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    <div className="text-lg mb-1">📝</div>
                    <div className="text-sm font-bold">Compact Text</div>
                    <div className="text-xs text-zinc-500 font-normal mt-0.5">fm1 (1-line plain text)</div>
                  </button>

                  <button
                    onClick={() => handleUpdateFmMode("full")}
                    disabled={updatingSettings}
                    className={`py-4 px-4 rounded-xl font-medium border text-center transition-all duration-200 cursor-pointer ${
                      fmMode === "full"
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/5"
                        : "bg-zinc-800/40 border-zinc-700/50 hover:bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    <div className="text-lg mb-1">🖼️</div>
                    <div className="text-sm font-bold">Full Embed</div>
                    <div className="text-xs text-zinc-500 font-normal mt-0.5">fm2 (detailed embed)</div>
                  </button>
                </div>
              </div>


              <div className="mt-4 pt-4 border-t border-zinc-800/50">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <div className="text-sm font-semibold text-zinc-300">Show Audio Features in /fm</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Toggle track features like stats.fm (BPM, Energy, Danceability) on your /fm embed.</div>
                  </div>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={showFeatures}
                      onChange={handleToggleFeatures}
                      disabled={updatingSettings}
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors duration-300 ${showFeatures ? 'bg-emerald-500' : 'bg-zinc-700'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ${showFeatures ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
              </div>

              <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-4 mt-2">
                <span className="text-zinc-500 text-xs leading-relaxed block">
                  💡 <strong>Tip:</strong> Even with a custom default set here, you can always override it in Discord by explicitly using <code>,fm1</code> (for compact text) or <code>,fm2</code> (for the full embed)!
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-zinc-800/50 pt-6 flex items-center justify-between text-xs text-zinc-500">
            <span>Linked with Discord</span>
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Settings Synced
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
