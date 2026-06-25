import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:glassmorphism/glassmorphism.dart';
import 'package:google_fonts/google_fonts.dart';
import 'login_screen.dart';

class StatsScreen extends StatefulWidget {
  const StatsScreen({super.key});

  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> {
  final storage = const FlutterSecureStorage();
  bool _isLoading = true;
  String _error = '';
  Map<String, dynamic>? _stats;

  @override
  void initState() {
    super.initState();
    _fetchStats();
  }

  Future<void> _fetchStats() async {
    try {
      final token = await storage.read(key: 'token');
      if (token == null || token.isEmpty) {
        _logout();
        return;
      }

      final response = await http.get(
        Uri.parse('https://the-goats-dj.vercel.app/api/user-stats'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          setState(() {
            _stats = data['stats'];
            _isLoading = false;
          });
        } else {
          setState(() {
            _error = data['error'] ?? 'Failed to load stats';
            _isLoading = false;
          });
        }
      } else if (response.statusCode == 401) {
        _logout();
      } else {
        setState(() {
          _error = 'Server error: ${response.statusCode}';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Connection error. Please try again.';
        _isLoading = false;
      });
    }
  }

  void _logout() async {
    await storage.delete(key: 'token');
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  Widget _buildStatCard(String title, String value, String subtitle, IconData icon, Color color) {
    return GlassmorphicContainer(
      width: double.infinity,
      height: 140,
      borderRadius: 20,
      blur: 20,
      alignment: Alignment.center,
      border: 2,
      linearGradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          color.withOpacity(0.15),
          color.withOpacity(0.05),
        ],
      ),
      borderGradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          color.withOpacity(0.5),
          Colors.white.withOpacity(0.1),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: color.withOpacity(0.2),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: color.withOpacity(0.3),
                    blurRadius: 10,
                    spreadRadius: 1,
                  ),
                ],
              ),
              child: Icon(icon, color: color, size: 32),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: Colors.white70,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    style: GoogleFonts.outfit(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  if (subtitle.isNotEmpty)
                    Text(
                      subtitle,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: Colors.white54,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFF0F172A), // Slate 900
              Color(0xFF020617), // Slate 950
            ],
          ),
        ),
        child: SafeArea(
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: Color(0xFF0AB5CD)),
                )
              : _error.isNotEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline, color: Colors.redAccent, size: 64),
                          const SizedBox(height: 16),
                          Text(
                            _error,
                            style: GoogleFonts.inter(color: Colors.white, fontSize: 16),
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton(
                            onPressed: _fetchStats,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0AB5CD),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text('Retry'),
                          ),
                          TextButton(
                            onPressed: _logout,
                            child: const Text('Logout', style: TextStyle(color: Colors.white70)),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _fetchStats,
                      color: const Color(0xFF0AB5CD),
                      backgroundColor: const Color(0xFF1E293B),
                      child: ListView(
                        padding: const EdgeInsets.all(24.0),
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Overview',
                                    style: GoogleFonts.outfit(
                                      fontSize: 32,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                  Text(
                                    'Your Listening Stats',
                                    style: GoogleFonts.inter(
                                      fontSize: 14,
                                      color: const Color(0xFF0AB5CD),
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                              IconButton(
                                icon: const Icon(Icons.logout, color: Colors.white70),
                                onPressed: _logout,
                                tooltip: 'Logout',
                              ),
                            ],
                          ),
                          const SizedBox(height: 32),
                          if (_stats != null && _stats!['hasLastfm'] == true) ...[
                            _buildStatCard(
                              'Last.fm Scrobbler',
                              _stats!['lastfm']['playcount'].toString(),
                              'Top: ${_stats!['lastfm']['topArtist']} (${_stats!['lastfm']['topArtistPlays']})',
                              Icons.audiotrack,
                              const Color(0xFFd51007), // Last.fm Red
                            ),
                            const SizedBox(height: 16),
                          ],
                          if (_stats != null && _stats!['hasSpotify'] == true) ...[
                            _buildStatCard(
                              'Spotify Tracker',
                              _stats!['spotify']['playcount'].toString(),
                              'Top: ${_stats!['spotify']['topArtist']} (${_stats!['spotify']['topArtistPlays']})',
                              Icons.library_music,
                              const Color(0xFF1DB954), // Spotify Green
                            ),
                          ],
                          if (_stats == null || (_stats!['hasLastfm'] == false && _stats!['hasSpotify'] == false)) ...[
                            Center(
                              child: Padding(
                                padding: const EdgeInsets.all(32.0),
                                child: Text(
                                  'No stats linked to your account. Please link Last.fm or Spotify using the Discord Bot.',
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.inter(color: Colors.white54, height: 1.5),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
        ),
      ),
    );
  }
}
