"use client";
import { useState, useEffect } from "react";

interface TrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackName: string;
  artistName: string;
  username?: string;
  fallbackImage?: string;
}

export default function TrackModal({ isOpen, onClose, trackName, artistName, username, fallbackImage }: TrackModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError(null);
      return;
    }

    const fetchTrackInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        let url = `/api/track?track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}`;
        if (username) url += `&username=${encodeURIComponent(username)}`;
        
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load track info.");
        
        const trackData = await res.json();
        setData(trackData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTrackInfo();
  }, [isOpen, trackName, artistName, username]);

  if (!isOpen) return null;

  // Find image from Last.fm response if available, otherwise use fallback
  let imageUrl = fallbackImage || null;
  if (data?.album?.image) {
    const largeImage = data.album.image.find((i: any) => i.size === "extralarge" || i.size === "large");
    if (largeImage && largeImage["#text"] && !largeImage["#text"].includes("2a96cbd8b46e442fc41c2b86b821562f")) {
      imageUrl = largeImage["#text"];
    }
  }

  // Formatting large numbers
  const formatNumber = (num: string | number) => {
    if (!num) return "0";
    return parseInt(num.toString(), 10).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-white/10 rounded-full transition-colors z-10"
        >
          <svg className="w-5 h-5 text-zinc-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-zinc-400 font-medium animate-pulse">Fetching track data...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-white mb-2">Oops!</h3>
            <p className="text-zinc-400">{error}</p>
            <button onClick={onClose} className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors font-medium">Close</button>
          </div>
        ) : (
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start">
              
              {/* Album Art */}
              <div className="w-48 h-48 md:w-56 md:h-56 shrink-0 rounded-2xl overflow-hidden shadow-2xl bg-zinc-900 border border-white/5 relative group">
                {imageUrl ? (
                  <img src={imageUrl} alt="Album Art" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl">🎵</div>
                )}
              </div>

              {/* Track Info Header */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight leading-tight">
                  {data?.name || trackName}
                </h2>
                <div className="text-xl text-indigo-400 font-bold mb-1">
                  {data?.artist?.name || artistName}
                </div>
                {data?.album?.title && (
                  <div className="text-zinc-400 font-medium">
                    from the album <span className="text-white font-semibold">{data.album.title}</span>
                  </div>
                )}

                {/* Stats Row */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-6">
                  {username && data?.userplaycount && (
                    <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                      <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Your Plays</div>
                      <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                        {formatNumber(data.userplaycount)}
                      </div>
                    </div>
                  )}
                  {data?.playcount && (
                    <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                      <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Global Plays</div>
                      <div className="text-xl font-black text-white">
                        {formatNumber(data.playcount)}
                      </div>
                    </div>
                  )}
                  {data?.listeners && (
                    <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                      <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Listeners</div>
                      <div className="text-xl font-black text-white">
                        {formatNumber(data.listeners)}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Last.fm Button */}
                {(data?.url || fallbackImage) && ( // we just need some url, data.url is usually always there
                  <div className="mt-6">
                     <a 
                      href={data?.url || `https://www.last.fm/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(trackName)}`}
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ba0000] hover:bg-[#d50000] text-white text-sm font-bold rounded-xl transition-all shadow-lg hover:shadow-[#ba0000]/30"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 13.932c-1.353 0-2.457-1.127-2.457-2.52 0-1.391 1.104-2.518 2.457-2.518 1.35 0 2.454 1.127 2.454 2.518 0 1.393-1.104 2.52-2.454 2.52m-.032-7.593c-2.316 0-4.227 1.636-4.707 3.821h-.041l-.988-3.666H7.135l1.631 5.922c-.655 1.579-2.029 2.584-3.665 2.584-1.634 0-2.906-1.154-2.906-2.616 0-1.464 1.258-2.619 2.906-2.619.673 0 1.298.243 1.834.717l2.179-2.81c-1.077-.962-2.502-1.554-4.013-1.554-3.088 0-5.022 2.306-5.022 5.253 0 2.946 2.052 5.266 5.022 5.266 2.873 0 5.158-2.051 5.626-4.664h.043c.535 2.529 2.766 4.664 5.728 4.664 3.09 0 5.568-2.519 5.568-5.656 0-3.136-2.478-5.645-5.568-5.645"/></svg>
                      View on Last.fm
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {data?.toptags?.tag && data.toptags.tag.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {data.toptags.tag.map((tag: any, i: number) => (
                    <a 
                      key={i} 
                      href={tag.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="px-3 py-1 bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/50 rounded-lg text-sm text-zinc-300 transition-colors"
                    >
                      {tag.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {data?.wiki?.summary && (
              <div className="mt-8 pt-8 border-t border-white/10">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">About this track</h3>
                <div 
                  className="text-zinc-300 text-sm leading-relaxed prose prose-invert max-w-none prose-a:text-indigo-400 hover:prose-a:text-indigo-300"
                  dangerouslySetInnerHTML={{ __html: data.wiki.summary }} 
                />
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
