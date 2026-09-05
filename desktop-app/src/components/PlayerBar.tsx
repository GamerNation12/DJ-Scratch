import { useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, Heart } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { RecentTrack, SpotifyNowPlaying } from '../lib/types';
import { api } from '../lib/api';

export default function PlayerBar({
  token,
  lastfmTrack,
  spotify,
  refresh,
}: {
  token: string | null;
  lastfmTrack?: RecentTrack | null;
  spotify: SpotifyNowPlaying | null;
  refresh: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const control = async (action: 'play' | 'pause' | 'next' | 'previous') => {
    if (!token || busy) return;
    setBusy(action);
    try {
      await api.spotifyControl(token, action);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Control failed');
    } finally {
      setBusy(null);
    }
  };

  const like = async () => {
    if (!token || !spotify?.id) return;
    try {
      await api.spotifyLike(token, spotify.id, spotify.is_liked ? 'unlike' : 'like');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Like failed');
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-4xl h-24 border border-white/10 bg-zinc-900/80 backdrop-blur-2xl rounded-[1.75rem] flex items-center justify-between px-6 z-20 shadow-2xl">
      <div className="flex items-center gap-4 w-72 min-w-0">
        <div className="w-14 h-14 bg-zinc-800 rounded-xl overflow-hidden shrink-0">
          {(spotify?.image || lastfmTrack?.image) && (
            <img src={spotify?.image || lastfmTrack?.image} className="w-full h-full object-cover" alt="" />
          )}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm truncate">{spotify?.title || lastfmTrack?.name || 'Not playing'}</div>
          <div className="text-xs text-zinc-400 truncate mt-1">{spotify?.artist || lastfmTrack?.artist || 'DJ Scratch'}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => control('previous')} disabled={!!busy} title="Previous" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 hover:bg-white/10 disabled:opacity-40">
          <SkipBack size={15} />
        </button>
        <button
          onClick={() => control(spotify?.is_playing ? 'pause' : 'play')}
          disabled={!!busy}
          title={spotify?.is_playing ? 'Pause' : 'Play'}
          className="w-11 h-11 rounded-full bg-green-500 hover:bg-green-400 text-black flex items-center justify-center disabled:opacity-40"
        >
          {busy ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : spotify?.is_playing ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
        </button>
        <button onClick={() => control('next')} disabled={!!busy} title="Next" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 hover:bg-white/10 disabled:opacity-40">
          <SkipForward size={15} />
        </button>
        <button onClick={like} disabled={!spotify?.id} title="Like" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 hover:bg-white/10 disabled:opacity-40">
          <Heart size={15} className={spotify?.is_liked ? 'text-green-400' : ''} fill={spotify?.is_liked ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}
