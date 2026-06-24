import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';

export default function StatsScreen() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchStats = async () => {
      const token = await SecureStore.getItemAsync('discord_token');
      if (!token) {
        router.replace('/');
        return;
      }

      try {
        const response = await fetch('https://the-goats-dj.vercel.app/api/user-stats', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          await SecureStore.deleteItemAsync('discord_token');
          router.replace('/');
          return;
        }

        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#5865F2" />
        <Text style={{color: '#fff', marginTop: 10}}>Loading your stats...</Text>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{color: '#fff'}}>Failed to load stats.</Text>
      </View>
    );
  }

  const totalPlays = (stats.lastfm?.playcount || 0) + (stats.spotify?.playcount || 0);
  const hasData = stats.hasLastfm || stats.hasSpotify;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Profile Section */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarPlaceholder}>
          <FontAwesome5 name="user" size={30} color="#fff" />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.username}>{stats.lastfm?.username || 'Your Stats'}</Text>
          <View style={styles.rankBadge}>
            <FontAwesome5 name="trophy" size={12} color="#FBBF24" />
            <Text style={styles.rankText}>Global Stats</Text>
          </View>
        </View>
      </View>

      {hasData ? (
        <>
          {/* Summary Stats */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{totalPlays.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Total Plays</Text>
            </View>
          </View>

          {stats.hasLastfm && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionTitle}>Last.fm Stats</Text>
              <View style={styles.scrobbleRow}>
                <View style={styles.scrobbleInfo}>
                  <Text style={styles.scrobbleTrack}>Top Artist</Text>
                  <Text style={styles.scrobbleArtist}>{stats.lastfm.topArtist} ({stats.lastfm.topArtistPlays} plays)</Text>
                </View>
              </View>
            </View>
          )}

          {stats.hasSpotify && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionTitle}>Spotify Stats</Text>
              <View style={styles.scrobbleRow}>
                <View style={styles.scrobbleInfo}>
                  <Text style={styles.scrobbleTrack}>Top Artist</Text>
                  <Text style={styles.scrobbleArtist}>{stats.spotify.topArtist} ({stats.spotify.topArtistPlays} plays)</Text>
                </View>
              </View>
            </View>
          )}
        </>
      ) : (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>No Stats</Text>
          <Text style={styles.summaryLabel}>Link your Spotify or Last.fm on the dashboard to see your stats here.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    padding: 20,
    paddingTop: 60, // padding for status bar area
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#5865F2',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    marginLeft: 15,
  },
  username: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  rankText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  summaryValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  summaryLabel: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  recentSection: {
    marginBottom: 20,
  },
  scrobbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  scrobbleInfo: {
    flex: 1,
    marginLeft: 5,
  },
  scrobbleTrack: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrobbleArtist: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 2,
  },
});
