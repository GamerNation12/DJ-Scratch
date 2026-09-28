export interface JwtUser {
  id: string;
  name: string;
  avatar?: string;
  image?: string;
  [k: string]: unknown;
}

export interface RecentTrack {
  name: string;
  artist: string;
  image?: string;
  nowPlaying?: boolean;
  url?: string;
  date?: string | null;
}

export interface TopItem {
  name: string;
  artist?: string;
  image?: string;
  playcount?: number | string;
}

export interface RhythmDailyPoint {
  date: string;
  plays: number | string;
}

export interface RhythmGenre {
  name: string;
  count: number | string;
}

export interface RhythmData {
  clock?: number[];
  daily?: RhythmDailyPoint[];
  streak?: number | string;
  longestStreak?: number | string;
  genres?: RhythmGenre[];
  discoveries?: string[];
  avgPerDay?: number | string;
  samplePlays?: number | string;
}

export interface UserStats {
  playcount?: number;
  recentTracks?: RecentTrack[];
  topArtists?: TopItem[];
  topTracks?: TopItem[];
  rhythm?: RhythmData | null;
}

export interface LeaderboardEntry {
  username: string;
  avatar?: string;
  total_scrobbles: string | number;
}

export interface Friend {
  friend_id: string;
  friend_username: string;
  display_name?: string;
  status: 'pending' | 'accepted';
  direction?: 'incoming' | 'outgoing';
}

export interface ChatMessage {
  id: string | number;
  sender_id: string;
  content: string;
  sent_at: string;
}

export interface SpotifyNowPlaying {
  id?: string;
  title?: string;
  song?: string;
  artist?: string;
  album?: string;
  image?: string;
  album_art?: string;
  is_playing?: boolean;
  is_liked?: boolean;
  progress_ms?: number;
  duration_ms?: number;
  uri?: string;
  spotify_url?: string;
  device?: string | { id?: string; name?: string } | null;
  shuffle_state?: boolean;
  repeat_state?: 'off' | 'track' | 'context' | string;
  volume_percent?: number;
}
