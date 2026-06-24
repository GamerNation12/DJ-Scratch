import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: true, 
      headerStyle: { backgroundColor: '#111' },
      headerTintColor: '#fff',
      tabBarStyle: { backgroundColor: '#111', borderTopColor: '#222' },
      tabBarActiveTintColor: '#fff',
    }}>
      <Tabs.Screen 
        name="stats" 
        options={{ 
          title: 'Stats',
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={24} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="admin" 
        options={{ 
          title: 'Admin',
          tabBarIcon: ({ color }) => <Ionicons name="shield-checkmark" size={24} color={color} />
        }} 
      />
    </Tabs>
  );
}
