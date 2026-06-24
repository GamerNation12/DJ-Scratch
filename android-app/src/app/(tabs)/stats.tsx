import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { mockUserData } from '../../data/mockData';
import { FontAwesome5 } from '@expo/vector-icons';

export default function StatsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Profile Section */}
      <View style={styles.profileHeader}>
        <Image source={{ uri: mockUserData.avatarUrl }} style={styles.avatar} />
        <View style={styles.profileInfo}>
          <Text style={styles.username}>{mockUserData.username}</Text>
          <View style={styles.rankBadge}>
            <FontAwesome5 name="trophy" size={12} color="#FBBF24" />
            <Text style={styles.rankText}>Global Rank #{mockUserData.globalRank}</Text>
          </View>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{mockUserData.totalScrobbles.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Total Plays</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{mockUserData.topArtists.length}</Text>
          <Text style={styles.summaryLabel}>Top Artists</Text>
        </View>
      </View>

      {/* Top Artists Horizontal List */}
      <Text style={styles.sectionTitle}>Your Top Artists</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.artistsScroll}>
        {mockUserData.topArtists.map((artist, index) => (
          <View key={artist.id} style={styles.artistCard}>
            <View style={styles.rankCircle}>
              <Text style={styles.rankCircleText}>{index + 1}</Text>
            </View>
            <Image source={{ uri: artist.imageUrl }} style={styles.artistImage} />
            <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
            <Text style={styles.artistPlays}>{artist.plays.toLocaleString()} plays</Text>
          </View>
        ))}
      </ScrollView>

      {/* Recent Scrobbles Vertical List */}
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recently Played</Text>
        {mockUserData.recentScrobbles.map((scrobble) => (
          <View key={scrobble.id} style={styles.scrobbleRow}>
            <Image source={{ uri: scrobble.imageUrl }} style={styles.scrobbleImage} />
            <View style={styles.scrobbleInfo}>
              <Text style={styles.scrobbleTrack} numberOfLines={1}>{scrobble.track}</Text>
              <Text style={styles.scrobbleArtist}>{scrobble.artist}</Text>
            </View>
            <Text style={styles.scrobbleTime}>{scrobble.timestamp}</Text>
          </View>
        ))}
      </View>
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
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#5865F2',
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
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  artistsScroll: {
    marginBottom: 30,
  },
  artistCard: {
    width: 130,
    marginRight: 15,
    alignItems: 'center',
  },
  rankCircle: {
    position: 'absolute',
    top: -5,
    left: -5,
    backgroundColor: '#5865F2',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  rankCircleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  artistImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
    marginBottom: 10,
  },
  artistName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  artistPlays: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
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
  scrobbleImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  scrobbleInfo: {
    flex: 1,
    marginLeft: 15,
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
  scrobbleTime: {
    color: '#555',
    fontSize: 12,
  },
});
