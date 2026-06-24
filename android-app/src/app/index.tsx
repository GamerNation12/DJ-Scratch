import { View, Text, StyleSheet, TouchableOpacity, Image, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen() {
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    // Check if we already have a token
    SecureStore.getItemAsync('discord_token').then(token => {
      if (token) {
        router.replace('/(tabs)/stats');
      }
    });
  }, []);

  const handleNavigationStateChange = async (navState: any) => {
    if (navState.url.includes('#token=')) {
      // Extract token from URL
      const token = navState.url.split('#token=')[1];
      if (token) {
        await SecureStore.setItemAsync('discord_token', token);
        setShowLogin(false);
        router.replace('/(tabs)/stats');
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.glassCard}>
        <Image 
          source={{ uri: 'https://media.discordapp.net/attachments/1118335048560066601/1118335345793617930/goat.png' }} 
          style={styles.logo} 
        />
        <Text style={styles.title}>The Goats DJ</Text>
        <Text style={styles.subtitle}>Premium Last.fm & Spotify Stats</Text>
        
        <TouchableOpacity style={styles.button} onPress={() => setShowLogin(true)}>
          <Text style={styles.buttonText}>Login with Discord</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showLogin} animationType="slide">
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowLogin(false)} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ uri: 'https://the-goats-dj.vercel.app/api/auth/login' }}
          onNavigationStateChange={handleNavigationStateChange}
          style={{ flex: 1 }}
          incognito={true}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassCard: {
    width: '85%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#5865F2', // Discord Blue
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalHeader: {
    height: 50,
    backgroundColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 15,
  },
  closeButton: {
    padding: 10,
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
