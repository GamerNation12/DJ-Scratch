export interface RecentTrack {
  name: string;
  artist: string;
  image?: string;
  nowPlaying?: boolean;
  date?: string | null;
}

export interface TopItem {
  name: string;
  artist?: string;
  image?: string;
  playcount?: string | number;
}

export interface UserStats {
  playcount?: number;
  recentTracks?: RecentTrack[];
  topArtists?: TopItem[];
  topTracks?: TopItem[];
}

export interface LeaderboardEntry {
  username: string;
  avatar?: string;
  playcount?: string | number;
  total_scrobbles?: string | number;
}

export interface Friend {
  friend_id: string;
  friend_username: string;
  display_name?: string;
  status: 'pending' | 'accepted';
  direction?: 'incoming' | 'outgoing';
}
