import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { mockAdminData } from '../../data/mockData';
import { FontAwesome5 } from '@expo/vector-icons';

export default function AdminScreen() {
  const isHealthy = mockAdminData.status === 'ONLINE';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>Admin Dashboard</Text>
        <View style={[styles.statusBadge, isHealthy ? styles.statusOnline : styles.statusOffline]}>
          <View style={[styles.statusDot, { backgroundColor: isHealthy ? '#4ade80' : '#ef4444' }]} />
          <Text style={[styles.statusText, { color: isHealthy ? '#4ade80' : '#ef4444' }]}>
            {mockAdminData.status}
          </Text>
        </View>
      </View>

      {/* Quick Metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <FontAwesome5 name="server" size={20} color="#5865F2" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{mockAdminData.activeServers.toLocaleString()}</Text>
          <Text style={styles.metricLabel}>Active Servers</Text>
        </View>
        <View style={styles.metricCard}>
          <FontAwesome5 name="users" size={20} color="#FBBF24" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{mockAdminData.totalUsers.toLocaleString()}</Text>
          <Text style={styles.metricLabel}>Total Users</Text>
        </View>
        <View style={styles.metricCard}>
          <FontAwesome5 name="database" size={20} color="#1DB954" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{mockAdminData.dbLatencyMs}ms</Text>
          <Text style={styles.metricLabel}>DB Latency</Text>
        </View>
        <View style={styles.metricCard}>
          <FontAwesome5 name="microchip" size={20} color="#F87171" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{mockAdminData.cpuUsagePct}%</Text>
          <Text style={styles.metricLabel}>CPU Usage</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn}>
          <FontAwesome5 name="sync-alt" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Restart Bot</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]}>
          <FontAwesome5 name="bullhorn" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Broadcast</Text>
        </TouchableOpacity>
      </View>

      {/* Terminal Logs */}
      <Text style={styles.sectionTitle}>System Logs</Text>
      <View style={styles.terminalContainer}>
        {mockAdminData.recentLogs.map((log) => {
          let color = '#aaa';
          if (log.type === 'ERROR') color = '#ef4444';
          if (log.type === 'WARNING') color = '#fbbf24';
          if (log.type === 'INFO') color = '#4ade80';

          return (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logTime}>[{log.time}]</Text>
              <Text style={[styles.logType, { color }]}>{log.type}</Text>
              <Text style={styles.logMessage}>{log.message}</Text>
            </View>
          );
        })}
        <Text style={styles.terminalCursor}>_</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505', // slightly darker for admin
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 10,
    width: '48%',
  },
  actionBtnSecondary: {
    backgroundColor: '#5865F2',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
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
    animation: 'blink 1s step-start infinite',
  },
});
