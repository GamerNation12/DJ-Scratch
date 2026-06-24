import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Required for expo-web-browser to work correctly
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();

  useEffect(() => {
    // Check if we already have a token
    SecureStore.getItemAsync('discord_token').then(token => {
      if (token) {
        router.replace('/(tabs)/stats');
      }
    });
  }, []);

  const handleLogin = async () => {
    const authUrl = 'https://the-goats-dj.vercel.app/api/auth/login?source=mobile';
    const redirectUrl = 'thegoatsdj://auth';
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        const data = Linking.parse(result.url);
        const token = data.queryParams?.token;
        if (token && typeof token === 'string') {
          await SecureStore.setItemAsync('discord_token', token);
          router.replace('/(tabs)/stats');
        }
      }
    } catch (e) {
      console.error("Auth error:", e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.glassCard}>
        <Image 
          source={require('../../assets/images/icon.png')} 
          style={styles.logo} 
        />
        <Text style={styles.title}>The Goats DJ</Text>
        <Text style={styles.subtitle}>Premium Last.fm & Spotify Stats</Text>
        
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Login with Discord</Text>
        </TouchableOpacity>
      </View>
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
  }
});
