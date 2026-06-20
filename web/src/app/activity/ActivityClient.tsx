"use client";

import { useEffect, useState, useRef } from 'react';
import { DiscordSDK } from "@discord/embedded-app-sdk";

interface Track {
  trackName: string;
  artistName: string;
  collectionName: string;
  previewUrl: string;
  artworkUrl100: string;
}

export default function ActivityClient({ clientId }: { clientId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'loading' | 'waiting' | 'playing' | 'revealed'>('loading');
  
  const [tracks, setTracks] = useState<Track[]>([]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  
  const [questionType, setQuestionType] = useState<'song' | 'artist' | 'album'>('song');
  const [correctTrack, setCorrectTrack] = useState<Track | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let sdk: DiscordSDK;
    try {
      sdk = new DiscordSDK(clientId);
    } catch (e: any) {
      console.error("SDK Init Error:", e);
      setError("This page must be opened within a Discord Voice Channel or App Launcher.");
      return;
    }

    async function setup() {
      try {
        await sdk.ready();
        
        // Use a variety of terms to get a good mix of popular music
        const genres = ["pop", "rap", "rock", "hip hop", "r&b", "hits", "top 40", "dance"];
        const randomGenre = genres[Math.floor(Math.random() * genres.length)];
        
        const res = await fetch(`https://itunes.apple.com/search?term=${randomGenre}&limit=200&entity=song`);
        const data = await res.json();
        
        const validTracks = data.results.filter((t: any) => t.previewUrl && t.trackName && t.artistName && t.collectionName);
        if (validTracks.length < 4) throw new Error("Not enough tracks found from iTunes.");
        
        setTracks(validTracks);
        setGameState('waiting');
      } catch (e: any) {
        console.error("Setup error:", e);
        setError(e.message || "Failed to initialize game. Please try reloading.");
      }
    }
    
    setup();
  }, [clientId]);

  const startRound = (pool: Track[]) => {
    const types: ('song' | 'artist' | 'album')[] = ['song', 'artist', 'album'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selectedTracks = shuffled.slice(0, 4);
    
    const correct = selectedTracks[0];
    
    let opts = selectedTracks.map(t => {
      if (type === 'song') return t.trackName;
      if (type === 'artist') return t.artistName;
      return t.collectionName;
    });
    
    opts = Array.from(new Set(opts));
    while (opts.length < 4) {
      const randomT = pool[Math.floor(Math.random() * pool.length)];
      const val = type === 'song' ? randomT.trackName : (type === 'artist' ? randomT.artistName : randomT.collectionName);
      if (!opts.includes(val)) opts.push(val);
    }
    
    opts = opts.sort(() => 0.5 - Math.random());
    
    setQuestionType(type);
    setCorrectTrack(correct);
    setOptions(opts);
    setSelectedOption(null);
    setGameState('playing');
    
    if (audioRef.current) {
      audioRef.current.src = correct.previewUrl;
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(e => console.error("Autoplay prevented", e));
    }
  };

  const [customSearch, setCustomSearch] = useState("");

  const handleStart = () => {
    // If they typed something, we need to fetch a new pool of songs
    if (customSearch.trim()) {
      setGameState('loading');
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(customSearch.trim())}&limit=200&entity=song`)
        .then(res => res.json())
        .then(data => {
          const validTracks = data.results.filter((t: any) => t.previewUrl && t.trackName && t.artistName && t.collectionName);
          if (validTracks.length < 4) {
            setError(`Not enough tracks found for "${customSearch}". Try a different artist or genre!`);
            return;
          }
          setTracks(validTracks);
          startRound(validTracks);
        })
        .catch(e => {
          setError("Failed to fetch custom tracks.");
        });
    } else {
      startRound(tracks);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white p-4">
        <div className="bg-zinc-900/50 border border-red-500/20 p-8 rounded-3xl text-center shadow-2xl relative">
          <button onClick={() => { setError(null); setGameState('waiting'); }} className="absolute top-4 right-4 text-zinc-500 hover:text-white">✕</button>
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p className="text-zinc-400 mb-6">{error}</p>
          <button onClick={() => { setError(null); setGameState('waiting'); }} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors font-bold">Go Back</button>
        </div>
      </div>
    );
  }

  if (gameState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white p-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
        <p className="text-indigo-400 font-bold tracking-widest uppercase animate-pulse">Loading Tunes...</p>
      </div>
    );
  }

  if (gameState === 'waiting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none" />
        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 mb-6 text-center drop-shadow-2xl">
          Guess The Tune
        </h1>
        <p className="text-zinc-400 mb-8 text-center max-w-md text-lg">
          Listen to the 30-second snippet and guess the song name, artist, or album!
        </p>
        
        <div className="w-full max-w-md mb-10 relative z-10">
          <input 
            type="text"
            value={customSearch}
            onChange={(e) => setCustomSearch(e.target.value)}
            placeholder="Optional: Enter an Artist or Genre..."
            className="w-full bg-zinc-900/80 border-2 border-white/10 focus:border-indigo-500 rounded-2xl px-6 py-4 text-white text-lg font-semibold placeholder:text-zinc-500 transition-all outline-none shadow-xl text-center"
            onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
          />
          <p className="text-zinc-500 text-xs text-center mt-2 font-semibold">Leave blank for random popular hits</p>
        </div>

        <button 
          onClick={handleStart}
          className="px-12 py-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-2xl rounded-full shadow-[0_0_40px_rgba(99,102,241,0.5)] hover:shadow-[0_0_60px_rgba(99,102,241,0.7)] hover:scale-105 transition-all duration-300 flex items-center gap-4 z-10"
        >
          <span className="text-3xl">▶</span> START GAME
        </button>
      </div>
    );
  }

  if (!correctTrack) return null;

  const getQuestionText = () => {
    if (questionType === 'song') return "What song is this?";
    if (questionType === 'artist') return "Who is the artist?";
    return "What album is this from?";
  };

  const getCorrectAnswer = () => {
    if (questionType === 'song') return correctTrack.trackName;
    if (questionType === 'artist') return correctTrack.artistName;
    return correctTrack.collectionName;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col p-6 selection:bg-indigo-500/30 overflow-hidden relative">
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-900/10 to-[#09090b] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-1/2 h-[300px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="flex justify-between items-center mb-8 relative z-10 w-full max-w-4xl mx-auto">
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div>
            <div className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Score</div>
            <div className="text-xl font-black text-white leading-none">{score}</div>
          </div>
        </div>
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
          <span className="text-2xl">💿</span>
          <div>
            <div className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Round</div>
            <div className="text-xl font-black text-white leading-none">{round}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full relative z-10">
        
        <h2 className="text-4xl md:text-5xl font-black text-center mb-12 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
          {getQuestionText()}
        </h2>

        {gameState === 'playing' ? (
          <div className="relative w-56 h-56 mb-16 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full animate-ping opacity-75 [animation-duration:2s]"></div>
            <div className="absolute inset-6 border-4 border-indigo-400/50 rounded-full animate-ping [animation-delay:0.4s] [animation-duration:2s] opacity-50"></div>
            <div className="absolute inset-12 border-4 border-purple-400/50 rounded-full animate-ping [animation-delay:0.8s] [animation-duration:2s] opacity-25"></div>
            <div className="w-36 h-36 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-[0_0_60px_rgba(99,102,241,0.6)] flex items-center justify-center z-10">
              <span className="text-6xl animate-bounce">🎵</span>
            </div>
          </div>
        ) : (
          <div className="w-56 h-56 mb-16 rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] border-4 border-white/10 relative group animate-fade-in-up">
            <img src={correctTrack.artworkUrl100.replace('100x100', '600x600')} alt="Album Art" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6 text-center">
              <div className="font-bold text-white text-lg mb-1 truncate">{correctTrack.trackName}</div>
              <div className="text-sm text-indigo-300 font-semibold truncate">{correctTrack.artistName}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full px-4">
          {options.map((opt, idx) => {
            let btnState = "bg-zinc-900/50 border-white/10 hover:border-indigo-500/50 hover:bg-white/5 hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] text-white hover:-translate-y-1";
            
            if (gameState === 'revealed') {
              const isCorrectOpt = opt === getCorrectAnswer();
              const isSelected = opt === selectedOption;
              
              if (isCorrectOpt) {
                btnState = "bg-green-500/20 border-green-500 text-green-300 shadow-[0_0_30px_rgba(34,197,94,0.4)] z-10 scale-[1.02] border-2";
              } else if (isSelected) {
                btnState = "bg-red-500/20 border-red-500/50 text-red-300 opacity-80 border-2";
              } else {
                btnState = "bg-zinc-900/20 border-white/5 text-zinc-600 opacity-40 scale-95";
              }
            }

            return (
              <button
                key={idx}
                disabled={gameState !== 'playing'}
                onClick={() => handleGuess(opt)}
                className={`p-6 rounded-2xl border-2 font-bold text-lg transition-all duration-500 text-center shadow-lg flex items-center justify-center ${btnState}`}
              >
                <span className="line-clamp-2">{opt}</span>
              </button>
            );
          })}
        </div>

        {gameState === 'revealed' && (
          <div className={`mt-10 text-3xl font-black uppercase tracking-widest animate-bounce ${selectedOption === getCorrectAnswer() ? 'text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}>
            {selectedOption === getCorrectAnswer() ? 'CORRECT! +1 🏆' : 'INCORRECT! ❌'}
          </div>
        )}
      </div>

      <audio ref={audioRef} onEnded={() => {
        if (gameState === 'playing') handleGuess("");
      }} />
    </div>
  );
}
