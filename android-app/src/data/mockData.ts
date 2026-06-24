export const mockUserData = {
  username: "GamerNation12",
  avatarUrl: "https://media.discordapp.net/attachments/1118335048560066601/1118335345793617930/goat.png",
  globalRank: 42,
  totalScrobbles: 15420,
  topArtists: [
    {
      id: "1",
      name: "Travis Scott",
      plays: 4520,
      imageUrl: "https://i.scdn.co/image/ab6761610000e5eb19c2790744c792d05570bb71",
    },
    {
      id: "2",
      name: "The Weeknd",
      plays: 3100,
      imageUrl: "https://i.scdn.co/image/ab6761610000e5eb2add52e23f05b0cdd9514704",
    },
    {
      id: "3",
      name: "Drake",
      plays: 2950,
      imageUrl: "https://i.scdn.co/image/ab6761610000e5eb4293385d324db8558179afd9",
    },
    {
      id: "4",
      name: "Kendrick Lamar",
      plays: 2100,
      imageUrl: "https://i.scdn.co/image/ab6761610000e5eb437b9e2a82505b3d93ff1022",
    },
  ],
  recentScrobbles: [
    {
      id: "101",
      track: "SICKO MODE",
      artist: "Travis Scott",
      timestamp: "2 mins ago",
      imageUrl: "https://i.scdn.co/image/ab67616d0000b273072e9faef2ef7b6db63834a3",
    },
    {
      id: "102",
      track: "Starboy",
      artist: "The Weeknd",
      timestamp: "7 mins ago",
      imageUrl: "https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452",
    },
    {
      id: "103",
      track: "God's Plan",
      artist: "Drake",
      timestamp: "12 mins ago",
      imageUrl: "https://i.scdn.co/image/ab67616d0000b2730e698ea75c401340b0f9c2d1",
    },
    {
      id: "104",
      track: "HUMBLE.",
      artist: "Kendrick Lamar",
      timestamp: "18 mins ago",
      imageUrl: "https://i.scdn.co/image/ab67616d0000b2731c360c79435b6fb89b4f4942",
    },
  ]
};

export const mockAdminData = {
  status: "ONLINE", // ONLINE, DEGRADED, OFFLINE
  activeServers: 1245,
  totalUsers: 84320,
  dbLatencyMs: 12,
  cpuUsagePct: 24,
  memoryUsageMb: 512,
  recentLogs: [
    { id: "201", type: "INFO", message: "Successfully connected to Discord Gateway", time: "10:00 AM" },
    { id: "202", type: "INFO", message: "Synced commands globally", time: "10:05 AM" },
    { id: "203", type: "WARNING", message: "High latency on Shard 3", time: "10:22 AM" },
    { id: "204", type: "INFO", message: "Joined new server: 'Cool Kids Club'", time: "10:45 AM" },
    { id: "205", type: "ERROR", message: "Failed to fetch Last.fm data for user ID 123", time: "11:10 AM" },
    { id: "206", type: "INFO", message: "Auto-restarted audio streaming service", time: "11:15 AM" },
  ]
};
