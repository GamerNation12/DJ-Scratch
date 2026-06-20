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

const SUGGESTED_PLAYLISTS = [
  { id: '1', title: 'Rock Classics', icon: '🎸', value: 'rock' },
  { id: '2', title: '2000s Music', icon: '💿', value: '2000s hits' },
  { id: '3', title: 'All-Time Hits & Classics', icon: '📻', value: 'classic hits' },
  { id: '4', title: 'Pop', icon: '🎤', value: 'pop' },
  { id: '5', title: 'Top Hits by Year', icon: '📅', value: 'hits' },
  { id: '6', title: 'Viral TikTok Hits', icon: '📱', value: 'tiktok' },
];

export default function ActivityClient({ clientId }: { clientId: string }) {
  // SDK & Connection State
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ username: string, avatar: string | null } | null>(null);
  
  // Game Flow State
  const [appState, setAppState] = useState<'lobby' | 'fetching' | 'playing' | 'revealed'>('lobby');
  
  // Lobby Settings State
  const [selectedPlaylist, setSelectedPlaylist] = useState(SUGGESTED_PLAYLISTS[2]);
  const [settings, setSettings] = useState({ mode: 'Multiple Choice', rounds: 20, duration: 15 });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // In-Game State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [score, setScore] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
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
      // Fallback for local testing if needed, but error is fine
      return;
    }

    async function setup() {
      try {
        await sdk.ready();
        const { code } = await sdk.commands.authorize({
          client_id: clientId,
          response_type: "code",
          state: "",
          prompt: "none",
          scope: ["identify"],
        });
        
        // Since we are running in an activity, we might not have a backend to exchange the token.
        // But we can get current user info if needed via discord APIs.
        // For now, we'll mock the user info based on sdk instance if available.
        setUser({ username: "GamerNation12", avatar: null }); 
      } catch (e: any) {
        console.error("Setup error:", e);
      }
    }
    setup();
  }, [clientId]);

  const handleStartGame = async () => {
    setAppState('fetching');
    try {
      const searchTerm = searchQuery.trim() || selectedPlaylist.value;
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&limit=200&entity=song`);
      const data = await res.json();
      
      const validTracks = data.results.filter((t: any) => t.previewUrl && t.trackName && t.artistName && t.collectionName);
      if (validTracks.length < 4) {
        setError(`Not enough tracks found for "${searchTerm}". Try a different genre!`);
        setAppState('lobby');
        return;
      }
      
      setTracks(validTracks);
      setScore(0);
      setCurrentRound(1);
      startRound(validTracks);
    } catch (e) {
      setError("Failed to fetch tracks. Please try again.");
      setAppState('lobby');
    }
  };

  const startRound = (pool: Track[]) => {
    if (currentRound > settings.rounds) {
      setAppState('lobby'); // End game
      return;
    }

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
    setAppState('playing');
    
    if (audioRef.current) {
      audioRef.current.src = correct.previewUrl;
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(e => console.error(e));
    }
  };

  const handleGuess = (opt: string) => {
    if (appState !== 'playing' || !correctTrack) return;
    
    setSelectedOption(opt);
    setAppState('revealed');
    
    const correctAnswer = questionType === 'song' ? correctTrack.trackName : 
                          questionType === 'artist' ? correctTrack.artistName : 
                          correctTrack.collectionName;
                      
    if (opt === correctAnswer) setScore(s => s + 1);
    
    setTimeout(() => {
      setCurrentRound(r => r + 1);
      startRound(tracks);
    }, 4000);
  };

  // --------------------------------------------------------------------------
  // LOBBY RENDER
  // --------------------------------------------------------------------------
  if (appState === 'lobby' || appState === 'fetching') {
    return (
      <div className="min-h-screen bg-[#111214] text-white flex font-sans overflow-hidden">
        {/* LEFT SIDEBAR */}
        <div className="w-[300px] bg-[#1e1f22] flex flex-col border-r border-[#2b2d31]">
          <div className="p-6">
            <h1 className="text-3xl font-black italic tracking-tight text-white mb-8">Guess The Song</h1>
            
            <div className="flex justify-between items-center mb-4 text-xs font-bold text-zinc-400">
              <span>PLAYERS (1)</span>
              <button className="flex items-center gap-1 bg-[#2b2d31] px-2 py-1 rounded">
                🏆 Leaderboard
              </button>
            </div>
            
            <div className="flex items-center justify-between bg-[#2b2d31] p-3 rounded-lg border border-[#3f4147]">
              <div className="flex items-center gap-3">
                <span className="text-yellow-500 font-black text-sm">1</span>
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center font-bold">
                  GN
                </div>
                <span className="font-semibold text-sm">GamerNation12</span>
              </div>
              <span className="text-indigo-400 text-xl font-bold">?</span>
            </div>
          </div>
          
          <div className="mt-auto p-4 flex flex-col gap-2">
            <button className="bg-[#2b2d31] hover:bg-[#3f4147] transition-colors py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              <span>⏪</span> Previous Games
            </button>
            <button className="bg-[#2b2d31] hover:bg-[#3f4147] transition-colors py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              <span>👁️</span> Spectator Mode
            </button>
            <button className="bg-[#2b2d31] hover:bg-[#3f4147] transition-colors py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              <span>💬</span> Support Server
            </button>
          </div>
        </div>

        {/* RIGHT MAIN PANEL */}
        <div className="flex-1 flex flex-col relative">
          
          {/* HEADER */}
          <div className="h-20 border-b border-[#2b2d31] flex items-center justify-between px-8 bg-[#111214] z-10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#2b2d31] rounded-lg flex items-center justify-center text-xl">📻</div>
              <div>
                <div className="font-bold text-lg flex items-center gap-2">
                  {selectedPlaylist.title} <span className="text-zinc-500 cursor-pointer text-sm">✏️</span>
                </div>
                <div className="text-xs text-zinc-400 flex items-center gap-1">
                  <div className="w-4 h-4 bg-indigo-500 rounded-full inline-block"></div>
                  GamerNation12 • The Goats
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-zinc-400 hover:text-white">⋮</button>
              <button className="text-zinc-400 hover:text-white">⚙️</button>
              <button onClick={handleStartGame} disabled={appState === 'fetching'} className="bg-white text-black font-bold px-6 py-2 rounded-full hover:bg-zinc-200 transition">
                {appState === 'fetching' ? 'Starting...' : 'Start Game'}
              </button>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="flex-1 p-10 flex flex-col justify-center relative max-w-5xl mx-auto w-full">
            
            <div className="flex justify-between items-start mb-16 relative">
              <div>
                <h2 className="text-5xl font-black mb-2 flex items-center gap-3">
                  {selectedPlaylist.title} <span className="text-zinc-500 text-3xl cursor-pointer">✏️</span>
                </h2>
                <p className="text-zinc-400 text-lg">Ready to Start</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="w-12 h-12 bg-[#2b2d31] rounded-full flex items-center justify-center text-xl hover:bg-[#3f4147]">📄</button>
                <button className="w-12 h-12 bg-[#2b2d31] rounded-full flex items-center justify-center text-xl hover:bg-[#3f4147]">🔀</button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-12">
              <div className="bg-[#1e1f22] p-6 rounded-2xl border border-[#2b2d31]">
                <div className="text-zinc-400 text-xs font-bold mb-2 uppercase flex items-center gap-2">
                  <span>🔲</span> Mode
                </div>
                <div className="text-xl font-bold">{settings.mode}</div>
              </div>
              <div className="bg-[#1e1f22] p-6 rounded-2xl border border-[#2b2d31]">
                <div className="text-zinc-400 text-xs font-bold mb-2 uppercase flex items-center gap-2">
                  <span>🔁</span> Rounds
                </div>
                <div className="text-xl font-bold">{settings.rounds}</div>
              </div>
              <div className="bg-[#1e1f22] p-6 rounded-2xl border border-[#2b2d31]">
                <div className="text-zinc-400 text-xs font-bold mb-2 uppercase flex items-center gap-2">
                  <span>⏱️</span> Duration
                </div>
                <div className="text-xl font-bold">{settings.duration}s</div>
              </div>
            </div>

            <button 
              onClick={() => setIsDropdownOpen(true)}
              className="w-full bg-white text-black font-black text-2xl py-6 rounded-2xl hover:bg-zinc-200 transition-transform active:scale-[0.98] disabled:opacity-50"
              disabled={appState === 'fetching'}
            >
              {appState === 'fetching' ? 'Loading Music...' : 'Start Game'}
            </button>

            {/* Error Message */}
            {error && <div className="mt-4 text-red-400 text-center font-semibold">{error}</div>}

            {/* PLAYLIST DROPDOWN MODAL */}
            {isDropdownOpen && (
              <div className="absolute top-0 left-0 w-full bg-[#1e1f22] rounded-2xl border border-[#2b2d31] shadow-2xl z-50 overflow-hidden flex flex-col max-h-[600px] animate-fade-in-up">
                <div className="p-4 border-b border-[#2b2d31]">
                  <div className="bg-[#111214] rounded-xl flex items-center px-4 py-3">
                    <span className="text-zinc-500 mr-3">🔍</span>
                    <input 
                      type="text" 
                      placeholder="Search for a playlist or enter a playlist link..." 
                      className="bg-transparent border-none outline-none text-white w-full placeholder:text-zinc-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if(e.key === 'Enter') { setIsDropdownOpen(false); handleStartGame(); } }}
                    />
                  </div>
                  <div className="flex gap-2 mt-4">
                    {['Your Playlists', 'Genres', 'Artists', 'Recent'].map(tab => (
                      <button key={tab} className="bg-[#2b2d31] hover:bg-[#3f4147] px-4 py-1.5 rounded-lg text-sm font-semibold text-zinc-300">
                        {tab}
                      </button>
                    ))}
                    <button className="ml-auto flex items-center gap-1 bg-[#2b2d31] px-4 py-1.5 rounded-lg text-sm font-semibold text-zinc-300">
                      <span>➕</span> Manage
                    </button>
                  </div>
                </div>
                
                <div className="p-4 overflow-y-auto">
                  <div className="text-xs font-bold text-zinc-500 mb-3">SUGGESTIONS</div>
                  <div className="grid grid-cols-2 gap-3">
                    {SUGGESTED_PLAYLISTS.map(pl => (
                      <button 
                        key={pl.id}
                        onClick={() => {
                          setSelectedPlaylist(pl);
                          setSearchQuery("");
                          setIsDropdownOpen(false);
                        }}
                        className="flex items-center gap-3 p-3 bg-[#2b2d31] hover:bg-[#3f4147] rounded-xl text-left transition-colors"
                      >
                        <div className="w-10 h-10 bg-[#111214] rounded-lg flex items-center justify-center text-xl">{pl.icon}</div>
                        <span className="font-bold">{pl.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setIsDropdownOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">✕</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // IN-GAME RENDER
  // --------------------------------------------------------------------------
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
    <div className="min-h-screen bg-[#111214] text-white flex flex-col p-6 selection:bg-indigo-500/30 overflow-hidden relative">
      <div className="flex justify-between items-center mb-8 w-full max-w-5xl mx-auto">
        <div className="bg-[#1e1f22] border border-[#2b2d31] px-6 py-3 rounded-2xl flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div>
            <div className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Score</div>
            <div className="text-xl font-black text-white leading-none">{score}</div>
          </div>
        </div>
        <div className="bg-[#1e1f22] border border-[#2b2d31] px-6 py-3 rounded-2xl flex items-center gap-3">
          <span className="text-2xl">💿</span>
          <div>
            <div className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Round</div>
            <div className="text-xl font-black text-white leading-none">{currentRound} / {settings.rounds}</div>
          </div>
        </div>
        <button onClick={() => setAppState('lobby')} className="bg-[#2b2d31] hover:bg-red-500/20 text-red-400 px-6 py-3 rounded-2xl font-bold transition">
          Quit
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full relative z-10">
        <h2 className="text-4xl md:text-5xl font-black text-center mb-12 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
          {getQuestionText()}
        </h2>

        {appState === 'playing' ? (
          <div className="relative w-56 h-56 mb-16 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-[#2b2d31] rounded-full animate-ping opacity-75 [animation-duration:2s]"></div>
            <div className="w-36 h-36 bg-[#1e1f22] border border-[#2b2d31] rounded-full flex items-center justify-center z-10 shadow-2xl">
              <span className="text-6xl animate-bounce">🎵</span>
            </div>
            {/* Timer visualizer */}
            <div className="absolute inset-[-20px] rounded-full border-4 border-t-indigo-500 border-r-indigo-500 border-b-transparent border-l-transparent animate-spin [animation-duration:3s]"></div>
          </div>
        ) : (
          <div className="w-56 h-56 mb-16 rounded-3xl overflow-hidden shadow-2xl border-4 border-[#2b2d31] relative group animate-fade-in-up">
            <img src={correctTrack.artworkUrl100.replace('100x100', '600x600')} alt="Album Art" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6 text-center">
              <div className="font-bold text-white text-lg mb-1 truncate">{correctTrack.trackName}</div>
              <div className="text-sm text-indigo-300 font-semibold truncate">{correctTrack.artistName}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full px-4">
          {options.map((opt, idx) => {
            let btnState = "bg-[#1e1f22] border-[#2b2d31] hover:border-indigo-500/50 hover:bg-[#2b2d31] text-white hover:-translate-y-1";
            
            if (appState === 'revealed') {
              const isCorrectOpt = opt === getCorrectAnswer();
              const isSelected = opt === selectedOption;
              
              if (isCorrectOpt) {
                btnState = "bg-green-500/20 border-green-500 text-green-300 shadow-[0_0_30px_rgba(34,197,94,0.2)] z-10 scale-[1.02] border-2";
              } else if (isSelected) {
                btnState = "bg-red-500/20 border-red-500/50 text-red-300 opacity-80 border-2";
              } else {
                btnState = "bg-[#1e1f22]/50 border-[#2b2d31] text-zinc-600 opacity-40 scale-95";
              }
            }

            return (
              <button
                key={idx}
                disabled={appState !== 'playing'}
                onClick={() => handleGuess(opt)}
                className={`p-6 rounded-2xl border-2 font-bold text-lg transition-all duration-500 text-center shadow-lg flex items-center justify-center ${btnState}`}
              >
                <span className="line-clamp-2">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      <audio ref={audioRef} onEnded={() => {
        if (appState === 'playing') handleGuess("");
      }} />
    </div>
  );
}
