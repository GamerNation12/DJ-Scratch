"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";
import JSZip from "jszip";

export default function Home() {
  const { data: session, status } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

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
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-full transition-all duration-200 shadow-lg shadow-indigo-500/30"
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
      
      setMessage(`Found ${tracks.length} tracks. Uploading in batches...`);
      
      // Small batches to stay well within Vercel's 10s timeout
      const chunkSize = 50;
      let successCount = 0;
      
      for (let i = 0; i < tracks.length; i += chunkSize) {
        const chunk = tracks.slice(i, i + chunkSize);
        
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chunk),
        });
        
        if (res.ok) {
          successCount += chunk.length;
          setMessage(`Uploaded ${successCount}/${tracks.length} tracks...`);
        } else {
          console.error("Failed batch", res);
        }
      }
      
      setMessage("Upload complete! 🎉 You can now use the bot commands.");
    } catch (error: any) {
      console.error(error);
      setMessage(error.message || "Error parsing or uploading file. Make sure it's a valid Spotify JSON or ZIP file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        <span className="text-zinc-400">Logged in as <strong className="text-white">{session.user?.name}</strong></span>
        <button onClick={() => signOut()} className="text-sm bg-zinc-800 hover:bg-zinc-700 py-2 px-4 rounded-md transition-colors">Sign Out</button>
      </div>

      <div className="max-w-xl w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-2">Import History</h1>
        <p className="text-zinc-400 mb-8">Select your Spotify `my_spotify_data.zip` or a `StreamingHistory.json` file to upload to your profile.</p>

        <form onSubmit={handleUpload} className="flex flex-col gap-6">
          <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:bg-zinc-800/50 transition-colors cursor-pointer relative">
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
              <span className="text-zinc-500">Click or drag your JSON file here</span>
            )}
          </div>

          <button
            type="submit"
            disabled={!file || uploading}
            className="bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-xl transition-all duration-200"
          >
            {uploading ? "Uploading..." : "Start Import"}
          </button>
        </form>

        {message && (
          <div className="mt-6 p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-center">
            <p className="text-zinc-300 font-mono text-sm">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
