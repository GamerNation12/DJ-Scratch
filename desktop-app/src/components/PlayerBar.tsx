import { useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, Heart, Shuffle, Repeat, Volume2, VolumeX, Speaker } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { RecentTrack, SpotifyNowPlaying } from '../lib/types';
import { api, type SpotifyDevice } from '../lib/api';

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type RepeatState = 'off' | 'context' | 'track';

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
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [showDevices, setShowDevices] = useState(false);
  const [volume, setVolume] = useState<number | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatState>('off');
  const [muted, setMuted] = useState(false);

  // Live progress ticker: advance locally while playing, resync on poll.
  const trackId = spotify?.id ?? spotify?.uri ?? null;
  const serverProgress = typeof spotify?.progress_ms === 'number' ? spotify.progress_ms : 0;
  const duration = typeof spotify?.duration_ms === 'number' ? spotify.duration_ms : 0;
  const [localProgress, setLocalProgress] = useState(serverProgress);
  const trackRef = useRef(trackId);
  const serverProgressRef = useRef(serverProgress);

  useEffect(() => {
    if (trackRef.current !== trackId || Math.abs(serverProgress - serverProgressRef.current) > 3000) {
      trackRef.current = trackId;
      serverProgressRef.current = serverProgress;
      setLocalProgress(serverProgress);
    }
  }, [trackId, serverProgress]);

  useEffect(() => {
    serverProgressRef.current = serverProgress;
  }, [serverProgress]);

  useEffect(() => {
    if (!spotify?.is_playing) return;
    const id = setInterval(() => {
      setLocalProgress((p) => (duration > 0 ? Math.min(p + 1000, duration) : p + 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [spotify?.is_playing, duration, trackId]);

  // Sync shuffle/repeat/volume from server when it provides them.
  useEffect(() => {
    if (typeof spotify?.shuffle_state === 'boolean') setShuffle(spotify.shuffle_state);
  }, [spotify?.shuffle_state]);
  useEffect(() => {
    const r = spotify?.repeat_state;
    if (r === 'off' || r === 'context' || r === 'track') setRepeat(r);
  }, [spotify?.repeat_state]);
  useEffect(() => {
    if (typeof spotify?.volume_percent === 'number') setVolume(spotify.volume_percent);
  }, [spotify?.volume_percent]);

  const loadDevices = async () => {
    if (!token) return;
    try {
      const data = await api.spotifyDevices(token);
      const list = Array.isArray(data.devices) ? data.devices : [];
      setDevices(list);
      const active = list.find((d) => d.is_active);
      if (active && typeof active.volume_percent === 'number' && volume == null) {
        setVolume(active.volume_percent);
      }
    } catch {
      // Best-effort; device picker just stays empty.
    }
  };

  useEffect(() => {
    loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  const sendControl = async (key: string, body: Parameters<typeof api.spotifyControl>[1], optimistic?: () => void) => {
    if (!token) return;
    setBusy(key);
    try {
      optimistic?.();
      await api.spotifyControl(token, body);
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

  const seek = async (posMs: number) => {
    if (!token || duration <= 0) return;
    const clamped = Math.max(0, Math.min(Math.round(posMs), duration));
    setLocalProgress(clamped);
    try {
      await api.spotifyControl(token, { action: 'seek', position_ms: clamped });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Seek failed');
    }
  };

  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitVolume = (v: number) => {
    if (!token) return;
    if (volumeTimer.current) clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(async () => {
      try {
        await api.spotifyControl(token, { action: 'volume', volume: v });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Volume failed');
      }
    }, 400);
  };

  const toggleShuffle = () =>
    sendControl('shuffle', { action: 'shuffle', state: !shuffle }, () => setShuffle((s) => !s));

  const cycleRepeat = () => {
    const next: RepeatState = repeat === 'off' ? 'context' : repeat === 'context' ? 'track' : 'off';
    sendControl('repeat', { action: 'repeat', state: next }, () => setRepeat(next));
  };

  const transfer = async (deviceId: string) => {
    if (!token) return;
    setBusy(`transfer:${deviceId}`);
    try {
      await api.spotifyControl(token, { action: 'transfer', device_id: deviceId, play: true });
      toast.success('Playback transferred');
      setShowDevices(false);
      await loadDevices();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setBusy(null);
    }
  };

  const title = spotify?.song ?? spotify?.title ?? lastfmTrack?.name ?? 'Not playing';
  const artist = spotify?.artist ?? lastfmTrack?.artist ?? 'DJ Scratch';
  const image = spotify?.album_art ?? spotify?.image ?? lastfmTrack?.image ?? null;
  const deviceLabel =
    typeof spotify?.device === 'string'
      ? spotify.device
      : spotify?.device && typeof spotify.device === 'object' && spotify.device.name
        ? spotify.device.name
        : devices.find((d) => d.is_active)?.name ?? '';
  const pct = duration > 0 ? Math.min(100, (localProgress / duration) * 100) : 0;
  const vol = volume ?? devices.find((d) => d.is_active)?.volume_percent ?? 50;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-4xl border border-white/10 bg-zinc-900/80 backdrop-blur-2xl rounded-[1.75rem] z-20 shadow-2xl overflow-hidden">
      {/* Clickable seek bar */}
      <div
        className="h-1.5 bg-white/5 cursor-pointer group/seek"
        title={duration > 0 ? `Seek — ${fmt(localProgress)} / ${fmt(duration)}` : 'Seek'}
        onClick={(e) => {
          if (duration <= 0) return;
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          seek(ratio * duration);
        }}
      >
        <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-[width]" style={{ width: `${pct}%` }} />
      </div>

      <div className="h-24 flex items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-4 w-64 min-w-0">
          <div className="w-14 h-14 bg-zinc-800 rounded-xl overflow-hidden shrink-0">
            {image && <img src={image} className="w-full h-full object-cover" alt="" />}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{title}</div>
            <div className="text-xs text-zinc-400 truncate mt-1">{artist}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
              {duration > 0 ? `${fmt(localProgress)} / ${fmt(duration)}` : deviceLabel || 'DJ Scratch'}
              {duration > 0 && deviceLabel ? ` · ${deviceLabel}` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleShuffle}
            disabled={!!busy}
            title={shuffle ? 'Shuffle on' : 'Shuffle off'}
            className={`w-9 h-9 rounded-full border flex items-center justify-center disabled:opacity-40 ${
              shuffle ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Shuffle size={15} />
          </button>
          <button onClick={() => control('previous')} disabled={!!busy} title="Previous" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 hover:bg-white/10 disabled:opacity-40">
            <SkipBack size={15} />
          </button>
          <button
            onClick={() => control(spotify?.is_playing ? 'pause' : 'play')}
            disabled={!!busy}
            title={spotify?.is_playing ? 'Pause' : 'Play'}
            className="w-11 h-11 rounded-full bg-green-500 hover:bg-green-400 text-black flex items-center justify-center disabled:opacity-40"
          >
            {busy && !busy.startsWith('transfer:') ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : spotify?.is_playing ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
          </button>
          <button onClick={() => control('next')} disabled={!!busy} title="Next" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 hover:bg-white/10 disabled:opacity-40">
            <SkipForward size={15} />
          </button>
          <button
            onClick={cycleRepeat}
            disabled={!!busy}
            title={`Repeat: ${repeat}`}
            className={`relative w-9 h-9 rounded-full border flex items-center justify-center disabled:opacity-40 ${
              repeat !== 'off' ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Repeat size={15} />
            {repeat === 'track' && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 text-black text-[9px] font-black flex items-center justify-center">1</span>}
            {repeat === 'context' && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400" />}
          </button>
          <button onClick={like} disabled={!spotify?.id} title="Like" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 hover:bg-white/10 disabled:opacity-40">
            <Heart size={15} className={spotify?.is_liked ? 'text-green-400' : ''} fill={spotify?.is_liked ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 w-64 justify-end">
          <button
            onClick={() => {
              const next = !muted;
              setMuted(next);
              if (next) commitVolume(0);
              else commitVolume(volume ?? 50);
            }}
            title={muted ? 'Unmute' : 'Mute'}
            className="text-zinc-400 hover:text-white p-1"
          >
            {muted || vol === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={muted ? 0 : vol}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              setMuted(v === 0);
              commitVolume(v);
            }}
            title={`Volume ${vol}%`}
            className="w-24 accent-green-500"
          />
          <div className="relative">
            <button
              onClick={() => {
                setShowDevices((s) => !s);
                if (!showDevices) loadDevices();
              }}
              title="Devices"
              className={`w-9 h-9 rounded-full border flex items-center justify-center ${showDevices ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'}`}
            >
              <Speaker size={15} />
            </button>
            {showDevices && (
              <div className="absolute bottom-11 right-0 w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-white/5">Devices</div>
                {devices.length === 0 && <div className="px-4 py-3 text-sm text-zinc-500">No devices found.</div>}
                {devices.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => transfer(d.id)}
                    disabled={busy === `transfer:${d.id}`}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-2 disabled:opacity-50"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${d.is_active ? 'bg-green-400' : 'bg-zinc-600'}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold truncate">{d.name}</span>
                      <span className="block text-[11px] text-zinc-500 capitalize">{d.type}{typeof d.volume_percent === 'number' ? ` · ${d.volume_percent}%` : ''}</span>
                    </span>
                    {busy === `transfer:${d.id}` && <span className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
