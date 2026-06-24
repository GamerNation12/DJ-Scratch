import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function StatsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Your Top Artists</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Travis Scott</Text>
        <Text style={styles.cardSub}>4,520 plays</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. The Weeknd</Text>
        <Text style={styles.cardSub}>3,100 plays</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. Drake</Text>
        <Text style={styles.cardSub}>2,950 plays</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    padding: 20,
  },
  header: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardSub: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 5,
  },
});
