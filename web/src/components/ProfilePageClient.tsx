"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "@/app/providers";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Tabs } from "@/components/ui";

export default function ProfilePageClient({
  usernameParam,
  profileData,
  rhythmData,
  recapData,
}: {
  usernameParam: string;
  profileData: any;
  rhythmData: any;
  recapData: any;
}) {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const isMounted = useRef(true);

  const [period, setPeriod] = useState("7day");
  const [recapPeriod, setRecapPeriod] = useState("week");
  const [activeTab, setActiveTab] = useState("profile");
  const [bio, setBio] = useState(profileData?.bio || "");
  const [website, setWebsite] = useState(profileData?.website || "");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "charts" || tab === "activity" || tab === "import" || tab === "admin") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const displayName = profileData?.displayName || usernameParam;
  const playcount = Number(profileData?.playcount || 0);
  const topArtists = profileData?.topArtists || [];
  const topTracks = profileData?.topTracks || [];
  const recentTracks = profileData?.recentTracks || [];
  const isOwner =
    status === "authenticated" &&
    session?.user?.name === usernameParam;

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <div className="max-w-5xl mx-auto pb-28">
      {/* Profile Header */}
      <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-950/40 to-purple-950/30 p-6 md:p-8 mb-8">
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            {profileData?.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileData.avatar}
                alt={displayName}
                className="w-20 h-20 rounded-full border-2 border-white/20"
              />
            )}
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">
                {displayName}
              </h1>
              <p className="text-zinc-400 mb-2">@{usernameParam}</p>
              {bio && <p className="text-zinc-300 mt-2 max-w-lg">{bio}</p>}
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 text-sm mt-1 inline-block"
                >
                  {website}
                </a>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-2xl font-bold text-white">{formatNumber(playcount)}</div>
              <div className="text-xs text-zinc-400">Total Plays</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-2xl font-bold text-white">{topArtists.length}</div>
              <div className="text-xs text-zinc-400">Top Artists</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-2xl font-bold text-white">{topTracks.length}</div>
              <div className="text-xs text-zinc-400">Top Tracks</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-2xl font-bold text-white">{recentTracks.length}</div>
              <div className="text-xs text-zinc-400">Recent Tracks</div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs
        tabs={[
          { value: "profile", label: "Profile" },
          { value: "charts", label: "Charts" },
          { value: "activity", label: "Activity" },
        ]}
        value={activeTab}
        onChange={(key) => setActiveTab(key as string)}
      />

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "profile" && (
          <div className="space-y-6">
            {/* Top Artists */}
            {topArtists.length > 0 && (
              <section className="rounded-xl border border-white/10 bg-white/5 p-4 md:p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Top Artists</h2>
                <div className="space-y-3">
                  {topArtists.slice(0, 10).map((artist: any, i: number) => (
                    <div key={artist.name || i} className="flex items-center gap-3">
                      <span className="text-sm text-zinc-500 w-6">{i + 1}</span>
                      {artist.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={artist.image} alt={artist.name} className="w-8 h-8 rounded" />
                      )}
                      <span className="text-white flex-1 truncate">{artist.name}</span>
                      <span className="text-zinc-400 text-sm">{formatNumber(Number(artist.playcount || 0))} plays</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Top Tracks */}
            {topTracks.length > 0 && (
              <section className="rounded-xl border border-white/10 bg-white/5 p-4 md:p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Top Tracks</h2>
                <div className="space-y-3">
                  {topTracks.slice(0, 10).map((track: any, i: number) => (
                    <div key={`${track.name}-${i}`} className="flex items-center gap-3">
                      <span className="text-sm text-zinc-500 w-6">{i + 1}</span>
                      {track.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={track.image} alt={track.name} className="w-8 h-8 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white truncate">{track.name}</p>
                        <p className="text-zinc-400 text-sm truncate">{track.artist}</p>
                      </div>
                      <span className="text-zinc-400 text-sm">{formatNumber(Number(track.playcount || 0))} plays</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === "charts" && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Listening Rhythm</h2>
            {rhythmData ? (
              <div className="space-y-4">
                {rhythmData.daily && rhythmData.daily.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-300 mb-2">Daily Plays</h3>
                    <div className="flex items-end gap-1 h-24">
                      {rhythmData.daily.map((d: any, i: number) => (
                        <div
                          key={i}
                          className="flex-1 bg-indigo-500/60 rounded-t"
                          style={{ height: `${Math.max(4, ((d?.plays || 0) / Math.max(1, ...rhythmData.daily.map((x: any) => Number(x?.plays || 0)))) * 100)}%` }}
                          title={`${d.date}: ${d.plays} plays`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {rhythmData.genres && rhythmData.genres.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-300 mb-2">Top Genres</h3>
                    <div className="flex flex-wrap gap-2">
                      {rhythmData.genres.slice(0, 10).map((g: any, i: number) => (
                        <span key={i} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm">
                          {g.name} ({g.count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-zinc-400">No rhythm data available for this period.</p>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
            {recentTracks.length > 0 ? (
              <div className="space-y-3">
                {recentTracks.slice(0, 20).map((track: any, i: number) => (
                  <div key={`${track.name}-${track.date}-${i}`} className="flex items-center gap-3">
                    {track.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={track.image} alt={track.name} className="w-10 h-10 rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">{track.name}</p>
                      <p className="text-zinc-400 text-sm truncate">{track.artist}</p>
                    </div>
                    {track.date && (
                      <span className="text-zinc-500 text-xs">{new Date(Number(track.date) * 1000).toLocaleDateString()}</span>
                    )}
                    {track.nowPlaying && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Now Playing</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-400">No recent tracks available.</p>
            )}
          </div>
        )}
      </div>

      {/* Settings link for owner */}
      {isOwner && (
        <div className="mt-8 pt-6 border-t border-white/10">
          <Link
            href={`/${encodeURIComponent(usernameParam)}/settings`}
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Edit profile settings →
          </Link>
        </div>
      )}
    </div>
  );
}
