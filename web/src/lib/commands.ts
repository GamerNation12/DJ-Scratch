export type BotCommand = {
  /** Slash command path, including the group when there is one. */
  command: string;
  description: string;
  usage: string;
  aliases?: string[];
  admin?: boolean;
  /** Short caveat shown under the command. */
  note?: string;
};

export type CommandCategory = {
  id: string;
  title: string;
  emoji: string;
  description: string;
  commands: BotCommand[];
};

export const COMMAND_CATEGORIES: CommandCategory[] = [
  {
    id: "now-playing",
    title: "Now Playing & Personal Stats",
    emoji: "🎧",
    description: "What you're spinning right now, plus your own listening stats.",
    commands: [
      {
        command: "/fm",
        description: "Show what you're playing now or the last track you played.",
        usage: "/fm [@user]",
        aliases: ["np", "nowplaying"],
      },
      {
        command: "/profile",
        description: "Your listening profile card with totals and top artists.",
        usage: "/profile [@user]",
      },
      {
        command: "/taste",
        description: "Compare your music taste with another member.",
        usage: "/taste [@user]",
      },
      {
        command: "/live",
        description: "See what your DJ Scratch friends are listening to right now.",
        usage: "/live",
      },
      {
        command: "/insights",
        description: "24-hour plays, milestone progress and top-artist share.",
        usage: "/insights [@user]",
      },
      {
        command: "/share",
        description: "Generate a shareable music stats card for your profile.",
        usage: "/share",
      },
      {
        command: "/musiccard",
        description: "Create a shareable image card with your listening stats.",
        usage: "/musiccard",
        aliases: ["mcard", "mycard", "card"],
      },
      {
        command: "/streak",
        description: "Check your current consecutive-play streak for an artist.",
        usage: "/streak [artist]",
      },
      {
        command: "/streakhistory",
        description: "See your past artist streaks with 25 or more plays.",
        usage: "/streakhistory",
      },
      {
        command: "/chart",
        description: "Build an album collage chart from your top albums.",
        usage: "/chart [size] [period]",
      },
      {
        command: "/artistchart",
        description: "Build an artist collage chart from your top artists.",
        usage: "/artistchart [size] [period]",
      },
      {
        command: "/badges",
        description: "Show the badges you've earned.",
        usage: "/badges",
        aliases: ["badge", "bd"],
      },
    ],
  },
  {
    id: "tops",
    title: "Tops & History",
    emoji: "📊",
    description: "Your top artists, tracks and albums, plus longer-term history.",
    commands: [
      {
        command: "/topartists",
        description: "View your most-played artists for a chosen period.",
        usage: "/topartists [period] [@user]",
        aliases: ["ta", "topa", "tart"],
      },
      {
        command: "/toptracks",
        description: "View your most-played tracks for a chosen period.",
        usage: "/toptracks [period] [@user]",
        aliases: ["tt", "topt", "ttr"],
      },
      {
        command: "/topalbums",
        description: "View your most-played albums for a chosen period.",
        usage: "/topalbums [period] [@user]",
      },
      {
        command: "/recent",
        description: "Show your recent listening history.",
        usage: "/recent [@user]",
        aliases: ["rt", "recents", "rtracks"],
      },
      {
        command: "/artisttracks",
        description: "See your top tracks for one specific artist.",
        usage: "/artisttracks [artist] [@user]",
        aliases: ["at", "art", "atracks"],
      },
      {
        command: "/stats plays",
        description: "Total scrobbles for a chosen period.",
        usage: "/stats plays [period] [@user]",
        aliases: ["plays"],
      },
      {
        command: "/stats pace",
        description: "See your daily rate and ETA for a playcount goal.",
        usage: "/stats pace [goal] [@user]",
        aliases: ["pace"],
      },
      {
        command: "/stats milestone",
        description: "Show your next scrobble milestones and progress.",
        usage: "/stats milestone [@user]",
        aliases: ["milestone", "ms"],
      },
      {
        command: "/stats overview",
        description: "A compact snapshot of your top track, album and artist.",
        usage: "/stats overview [@user]",
        aliases: ["overview", "o"],
      },
      {
        command: "/stats recap",
        description: "A combined tops recap for a chosen period.",
        usage: "/stats recap [period] [@user]",
        aliases: ["recap"],
      },
      {
        command: "/stats year",
        description: "Your yearly listening overview.",
        usage: "/stats year [@user]",
        aliases: ["year"],
      },
      {
        command: "/serverartists",
        description: "The server-wide top artists for a chosen period.",
        usage: "/serverartists [period]",
      },
      {
        command: "/serveralbums",
        description: "The server-wide top albums for a chosen period.",
        usage: "/serveralbums [period]",
      },
      {
        command: "/servertracks",
        description: "The server-wide top tracks for a chosen period.",
        usage: "/servertracks [period]",
      },
      {
        command: "/community scrobbleleaderboard",
        description: "Members with the most plays in this server.",
        usage: "/community scrobbleleaderboard",
        aliases: ["sblb"],
      },
      {
        command: "/community timeleaderboard",
        description: "Members with the most estimated listening time in this server.",
        usage: "/community timeleaderboard",
        aliases: ["tlb"],
      },
    ],
  },
  {
    id: "server",
    title: "Server, Crowns & Friends",
    emoji: "👑",
    description: "Compete with your server, find who-knows-who and manage crowns.",
    commands: [
      {
        command: "/whoknows",
        description: "See who in the server listens to an artist the most.",
        usage: "/whoknows <artist>",
        aliases: ["wk", "who", "w"],
      },
      {
        command: "/whoknowstrack",
        description: "See who in the server plays a specific track the most.",
        usage: "/whoknowstrack <artist - track>",
        aliases: ["wkt", "wt"],
      },
      {
        command: "/whoknowsalbum",
        description: "See who in the server plays a specific album the most.",
        usage: "/whoknowsalbum <artist - album>",
        aliases: ["wka", "wa"],
      },
      {
        command: "/globalwhoknows",
        description: "See who across all DJ Scratch servers listens to an artist the most.",
        usage: "/globalwhoknows <artist>",
      },
      {
        command: "/globalwhoknowstrack",
        description: "See who globally plays a track the most.",
        usage: "/globalwhoknowstrack <artist - track>",
      },
      {
        command: "/globalwhoknowsalbum",
        description: "See who globally plays an album the most.",
        usage: "/globalwhoknowsalbum <artist - album>",
      },
      {
        command: "/crowns",
        description: "See which of your top artists you hold the crown for.",
        usage: "/crowns [@user]",
        aliases: ["cr", "cw"],
      },
      {
        command: "/crownseeder",
        description: "Seed crowns for every member in the server.",
        usage: "/crownseeder",
        admin: true,
      },
      {
        command: "/killallcrowns",
        description: "Remove all seeded crowns for the server.",
        usage: "/killallcrowns",
        admin: true,
      },
      {
        command: "/community affinity",
        description: "Find the member whose taste matches yours most.",
        usage: "/community affinity",
      },
      {
        command: "/community friendswhoknow",
        description: "See which of your friends listen to an artist.",
        usage: "/community friendswhoknow [artist]",
        aliases: ["fwk"],
      },
      {
        command: "/community friends",
        description: "List your DJ Scratch friends.",
        usage: "/community friends",
      },
      {
        command: "/community members",
        description: "See which members in this server have linked their accounts.",
        usage: "/community members",
        aliases: ["mb"],
      },
      {
        command: "/community featured",
        description: "See the current hourly featured listener.",
        usage: "/community featured",
      },
      {
        command: "/community featuredlog",
        description: "See the most recent featured listener.",
        usage: "/community featuredlog",
      },
      {
        command: "/today",
        description: "View today's community picks from any server you're in.",
        usage: "/today [server]",
      },
      {
        command: "/spotlight",
        description: "Post the daily community spotlight panel.",
        usage: "/spotlight",
        admin: true,
      },
    ],
  },
  {
    id: "account",
    title: "Account & Setup",
    emoji: "🔗",
    description: "Link Last.fm, import history and tune how the bot responds.",
    commands: [
      {
        command: "/login",
        description: "Link your Last.fm account or connect Spotify.",
        usage: "/login",
        aliases: ["log", "li"],
      },
      {
        command: "/logout",
        description: "Unlink Last.fm or Spotify from your account.",
        usage: "/logout [spotify]",
        aliases: ["lo"],
      },
      {
        command: "/import",
        description: "Upload a Spotify or Apple Music extended-history ZIP/CSV.",
        usage: "/import + attach file",
        aliases: ["imp", "i"],
      },
      {
        command: "/settings",
        description: "Open your display, /fm and privacy settings.",
        usage: "/settings",
      },
      {
        command: "/privacy",
        description: "Toggle private mode to hide your profile from public stats.",
        usage: "/privacy",
        aliases: ["pr", "priv"],
      },
      {
        command: "/outofsync",
        description: "Fix missing Spotify scrobbles on Last.fm.",
        usage: "/outofsync",
        aliases: ["spotifyauth", "missing"],
      },
      {
        command: "/setup responsemode",
        description: "Choose the default layout for tops and who-knows results.",
        usage: "/setup responsemode [mode]",
        aliases: ["responsemode"],
      },
      {
        command: "/setup userreactions",
        description: "Automatically react to your /fm with emojis.",
        usage: "/setup userreactions [emojis]",
        aliases: ["userreactions"],
      },
      {
        command: "/setup shortcuts",
        description: "Create custom text-command shortcuts.",
        usage: "/setup shortcuts [name] [command]",
        aliases: ["shortcuts", "sc"],
      },
      {
        command: "/setup localization",
        description: "Set your timezone and number format.",
        usage: "/setup localization [timezone] [number format]",
        aliases: ["localization"],
      },
      {
        command: "/setup togglecommand",
        description: "Enable or disable a command for the server.",
        usage: "/setup togglecommand [command]",
        admin: true,
      },
      {
        command: "/setup autoposter",
        description: "Set up a server listening digest channel.",
        usage: "/setup autoposter [channel]",
        admin: true,
      },
      {
        command: "/setup botscrobbling",
        description: "Scrobble music played by other Discord music bots.",
        usage: "/setup botscrobbling [on/off]",
        admin: true,
      },
      {
        command: "/cd",
        description: "Check the bot avatar cooldown and preview the avatar.",
        usage: "/cd",
      },
      {
        command: "/help",
        description: "Browse every command from inside Discord.",
        usage: "/help",
        aliases: ["h"],
      },
    ],
  },
  {
    id: "discovery",
    title: "Discovery & Music Details",
    emoji: "🔎",
    description: "Dig into artists, albums, tracks, genres and your listening gaps.",
    commands: [
      {
        command: "/artist",
        description: "Detailed stats about an artist.",
        usage: "/artist [artist]",
      },
      {
        command: "/album",
        description: "Detailed stats about an album.",
        usage: "/album [artist - album]",
      },
      {
        command: "/track",
        description: "Detailed stats about a track.",
        usage: "/track [artist - track]",
      },
      {
        command: "/stats genre",
        description: "Show genre tags for an artist.",
        usage: "/stats genre [artist]",
        aliases: ["genre"],
      },
      {
        command: "/stats country",
        description: "Show country information for an artist.",
        usage: "/stats country [artist]",
        aliases: ["country", "from"],
      },
      {
        command: "/stats countrychart",
        description: "See the top countries in your library.",
        usage: "/stats countrychart",
        aliases: ["countrychart"],
      },
      {
        command: "/stats search",
        description: "Search your own listening library.",
        usage: "/stats search [query]",
        aliases: ["search", "sr"],
      },
      {
        command: "/stats iceberg",
        description: "Explore an artist popularity iceberg from your library.",
        usage: "/stats iceberg [@user]",
        aliases: ["iceberg"],
      },
      {
        command: "/stats gaps",
        description: "Find favourites you haven't heard lately.",
        usage: "/stats gaps [@user]",
        aliases: ["gaps"],
      },
      {
        command: "/stats discoverydate",
        description: "Find out when you first discovered an artist or track.",
        usage: "/stats discoverydate [artist]",
        aliases: ["discoverydate", "ddate"],
      },
      {
        command: "/stats lastlistened",
        description: "See when you last heard an artist or track.",
        usage: "/stats lastlistened [artist]",
        aliases: ["lastlistened", "last"],
      },
      {
        command: "/stats discoveries",
        description: "Artists you've discovered recently.",
        usage: "/stats discoveries [@user]",
        aliases: ["discoveries"],
      },
      {
        command: "/music lyrics",
        description: "Fetch lyrics for the current track or a search query.",
        usage: "/music lyrics [query]",
        aliases: ["lyrics"],
      },
      {
        command: "/music loved",
        description: "Show your loved tracks on Last.fm.",
        usage: "/music loved",
        aliases: ["loved"],
      },
      {
        command: "/music love",
        description: "Love the track you're currently playing.",
        usage: "/music love",
        aliases: ["love"],
      },
      {
        command: "/music unlove",
        description: "Get guidance for removing a loved track.",
        usage: "/music unlove",
        aliases: ["unlove"],
      },
      {
        command: "/music scrobble",
        description: "Get guidance for manually scrobbling a track.",
        usage: "/music scrobble [query]",
        aliases: ["scrobble"],
      },
      {
        command: "/music youtube",
        description: "Get a YouTube link for the current track or a query.",
        usage: "/music youtube [query]",
        aliases: ["youtube", "yt"],
      },
      {
        command: "/music applemusic",
        description: "Get an Apple Music link for a track or query.",
        usage: "/music applemusic [query]",
        aliases: ["applemusic"],
      },
      {
        command: "/music discogs",
        description: "Link a Discogs vinyl collection (beta).",
        usage: "/music discogs",
        aliases: ["discogs"],
      },
      {
        command: "/music collection",
        description: "View your linked Discogs collection (beta).",
        usage: "/music collection",
        aliases: ["collection"],
      },
      {
        command: "/receipt",
        description: "Generate a top-tracks receipt image.",
        usage: "/receipt [period] [@user]",
        aliases: ["rec", "re"],
      },
    ],
  },
  {
    id: "fun",
    title: "Fun & Utility",
    emoji: "🎮",
    description: "Games, Spotify controls, bot info and feedback commands.",
    commands: [
      {
        command: "/guess",
        description: "Play a guess-the-album-cover game.",
        usage: "/guess",
        aliases: ["pixel", "px"],
      },
      {
        command: "/scramble",
        description: "Unscramble an artist or track name.",
        usage: "/scramble",
        aliases: ["jumble", "jb", "jm"],
      },
      {
        command: "/judge",
        description: "Let an AI judge your recent music taste.",
        usage: "/judge [@user]",
        aliases: ["roast", "jd", "j"],
      },
      {
        command: "/remote",
        description: "Open the Spotify remote panel with live controls.",
        usage: "/remote",
        note: "Spotify account owner only.",
      },
      {
        command: "/play",
        description: "Play a track, album or artist on Spotify.",
        usage: "/play [query]",
        note: "Spotify account owner only.",
      },
      {
        command: "/queue",
        description: "Queue a track on Spotify.",
        usage: "/queue [query]",
        note: "Spotify account owner only.",
      },
      {
        command: "/pause",
        description: "Pause Spotify playback.",
        usage: "/pause",
        note: "Spotify account owner only.",
      },
      {
        command: "/skip",
        description: "Skip to the next Spotify track.",
        usage: "/skip",
        note: "Spotify account owner only.",
      },
      {
        command: "/previous",
        description: "Go back to the previous Spotify track.",
        usage: "/previous",
        note: "Spotify account owner only.",
      },
      {
        command: "/rclike",
        description: "Like a track on Spotify.",
        usage: "/rclike [query]",
        note: "Spotify account owner only.",
      },
      {
        command: "/rcunlike",
        description: "Unlike a track on Spotify.",
        usage: "/rcunlike [query]",
        note: "Spotify account owner only.",
      },
      {
        command: "/spotify",
        description: "Get a Spotify link for the current track or a search.",
        usage: "/spotify [query]",
        aliases: ["sp"],
      },
      {
        command: "/spotifyalbum",
        description: "Get a Spotify link for the current album or a search.",
        usage: "/spotifyalbum [query]",
        aliases: ["spab"],
      },
      {
        command: "/spotifyartist",
        description: "Get a Spotify link for the current artist or a search.",
        usage: "/spotifyartist [query]",
        aliases: ["spa"],
      },
      {
        command: "/status",
        description: "Show bot uptime, ping and live stats.",
        usage: "/status",
      },
      {
        command: "/updates",
        description: "See the latest DJ Scratch updates.",
        usage: "/updates",
        aliases: ["changelog", "news", "up", "u"],
      },
      {
        command: "/guide",
        description: "Get a quick-start guide for using the bot.",
        usage: "/guide",
        aliases: ["start", "tutorial", "howto"],
      },
      {
        command: "/premium",
        description: "Preview upcoming premium features.",
        usage: "/premium",
        aliases: ["upgrade", "pro"],
      },
      {
        command: "/social",
        description: "Open the friends and direct-message command menu.",
        usage: "/social",
      },
      {
        command: "/dms",
        description: "Information about DJ Scratch direct messages.",
        usage: "/dms",
      },
      {
        command: "/deletedata",
        description: "Delete all of your imported data from the bot.",
        usage: "/deletedata",
        aliases: ["purgedata", "resetdata", "dd", "pd"],
      },
      {
        command: "/suggest",
        description: "Send a suggestion directly to the developer.",
        usage: "/suggest <idea>",
        aliases: ["suggestion", "su", "sug"],
      },
      {
        command: "/bug",
        description: "Report a bug directly to the developer.",
        usage: "/bug <description>",
        aliases: ["bugreport", "reportbug"],
      },
      {
        command: "/server",
        description: "Configure server settings.",
        usage: "/server",
        admin: true,
      },
    ],
  },
];

export const ALL_COMMANDS = COMMAND_CATEGORIES.flatMap((category) => category.commands);
