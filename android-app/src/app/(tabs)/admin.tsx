import { View, Text, StyleSheet } from 'react-native';

export default function AdminScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Admin Dashboard</Text>
      
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>Bot Status</Text>
          <Text style={styles.metricValueOnline}>Online</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>Servers</Text>
          <Text style={styles.metricValue}>1,245</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>DB Latency</Text>
          <Text style={styles.metricValue}>12ms</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  header: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  metricTitle: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 10,
  },
  metricValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  metricValueOnline: {
    color: '#4ade80',
    fontSize: 22,
    fontWeight: 'bold',
  },
});
