import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

export default function AdminScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAdmin = async () => {
      const token = await SecureStore.getItemAsync('discord_token');
      if (!token) {
        setError('Not Logged In');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('https://the-goats-dj.vercel.app/api/admin/stats', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 403 || response.status === 401) {
          setError('You do not have permission to view the Admin Dashboard.');
          setLoading(false);
          return;
        }

        const json = await response.json();
        setData(json);
      } catch (err) {
        console.error(err);
        setError('Failed to load admin stats.');
      } finally {
        setLoading(false);
      }
    };

    fetchAdmin();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#5865F2" />
        <Text style={{color: '#fff', marginTop: 10}}>Loading Admin Dashboard...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
        <FontAwesome5 name="lock" size={40} color="#ef4444" style={{marginBottom: 20}} />
        <Text style={{color: '#fff', fontSize: 18, textAlign: 'center'}}>{error || 'Failed to load'}</Text>
      </View>
    );
  }

  const isHealthy = data.statusActivity === 'ONLINE';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>Admin Dashboard</Text>
        <View style={[styles.statusBadge, isHealthy ? styles.statusOnline : styles.statusOffline]}>
          <View style={[styles.statusDot, { backgroundColor: isHealthy ? '#4ade80' : '#ef4444' }]} />
          <Text style={[styles.statusText, { color: isHealthy ? '#4ade80' : '#ef4444' }]}>
            {isHealthy ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      {/* Quick Metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <FontAwesome5 name="server" size={20} color="#5865F2" style={styles.metricIcon} />
          <Text style={styles.metricValue}>
            {data.botStats ? data.botStats.server_count.toLocaleString() : 'N/A'}
          </Text>
          <Text style={styles.metricLabel}>Active Servers</Text>
        </View>
        <View style={styles.metricCard}>
          <FontAwesome5 name="users" size={20} color="#FBBF24" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{data.totalUsers.toLocaleString()}</Text>
          <Text style={styles.metricLabel}>Total Website Users</Text>
        </View>
        <View style={styles.metricCard}>
          <FontAwesome5 name="headphones" size={20} color="#1DB954" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{data.totalPlays.toLocaleString()}</Text>
          <Text style={styles.metricLabel}>Total Plays Logged</Text>
        </View>
        <View style={styles.metricCard}>
          <FontAwesome5 name="microchip" size={20} color="#F87171" style={styles.metricIcon} />
          <Text style={styles.metricValue}>
            {data.botStats ? `${data.botStats.cpu_percent}%` : 'N/A'}
          </Text>
          <Text style={styles.metricLabel}>CPU Usage</Text>
        </View>
      </View>

      {/* Terminal Logs */}
      <Text style={styles.sectionTitle}>Top Commands</Text>
      <View style={styles.terminalContainer}>
        {data.commandUsage && data.commandUsage.map((cmd: any, index: number) => (
          <View key={index} style={styles.logRow}>
            <Text style={styles.logTime}>[{index + 1}]</Text>
            <Text style={[styles.logType, { color: '#5865F2' }]}>/{cmd.command_name}</Text>
            <Text style={styles.logMessage}>{cmd.usage_count} uses</Text>
          </View>
        ))}
        {(!data.commandUsage || data.commandUsage.length === 0) && (
          <Text style={styles.logMessage}>No commands recorded yet.</Text>
        )}
        <Text style={styles.terminalCursor}>_</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  header: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusOnline: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  statusOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  metricCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  metricIcon: {
    marginBottom: 10,
  },
  metricValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  metricLabel: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  terminalContainer: {
    backgroundColor: '#000',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 200,
  },
  logRow: {
    flexDirection: 'row',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  logTime: {
    color: '#555',
    fontFamily: 'monospace',
    marginRight: 8,
    fontSize: 12,
  },
  logType: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    marginRight: 8,
    fontSize: 12,
  },
  logMessage: {
    color: '#ddd',
    fontFamily: 'monospace',
    fontSize: 12,
    flex: 1,
  },
  terminalCursor: {
    color: '#4ade80',
    fontFamily: 'monospace',
    marginTop: 5,
  },
});
