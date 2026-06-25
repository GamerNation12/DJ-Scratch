import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:glassmorphism/glassmorphism.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:cached_network_image/cached_network_image.dart';
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
  Map<String, dynamic>? _user;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final token = await storage.read(key: 'token');
      if (token == null || token.isEmpty) {
        _logout();
        return;
      }

      final statsFuture = http.get(
        Uri.parse('https://the-goats-dj.vercel.app/api/user-stats'),
        headers: {'Authorization': 'Bearer $token'},
      );

      // Just a mock parsing of JWT to get user info locally without an extra request
      // We know JWT has id, name, email, image
      final parts = token.split('.');
      if (parts.length == 3) {
        final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
        _user = jsonDecode(payload);
      }

      final response = await statsFuture;

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
        PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) => const LoginScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(opacity: animation, child: child);
          },
        ),
      );
    }
  }

  Widget _buildStatCard(String title, String value, String subtitle, IconData icon, Color color, int index) {
    return GlassmorphicContainer(
      width: double.infinity,
      height: 140,
      borderRadius: 24,
      blur: 20,
      alignment: Alignment.center,
      border: 1,
      linearGradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          color.withOpacity(0.15),
          color.withOpacity(0.02),
        ],
      ),
      borderGradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          color.withOpacity(0.5),
          Colors.white.withOpacity(0.05),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: color.withOpacity(0.3), width: 1),
                boxShadow: [
                  BoxShadow(
                    color: color.withOpacity(0.2),
                    blurRadius: 20,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Icon(icon, color: color, size: 28),
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
                      fontSize: 13,
                      color: Colors.white60,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    value,
                    style: GoogleFonts.outfit(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (subtitle.isNotEmpty)
                    Text(
                      subtitle,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: color.withOpacity(0.9),
                        fontWeight: FontWeight.w500,
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
    ).animate().fade(delay: (200 + (index * 100)).ms).slideX(begin: 0.1, curve: Curves.easeOutBack);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: Stack(
        children: [
          // Dynamic Background
          Positioned(
            top: 50,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF0AB5CD).withOpacity(0.1),
              ),
            ).animate(onPlay: (controller) => controller.repeat(reverse: true))
             .scale(begin: const Offset(1, 1), end: const Offset(1.5, 1.5), duration: 8.seconds, curve: Curves.easeInOut),
          ),
          
          SafeArea(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF0AB5CD)),
                  )
                : _error.isNotEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(LucideIcons.alertCircle, color: Colors.redAccent, size: 48),
                            const SizedBox(height: 16),
                            Text(
                              _error,
                              style: GoogleFonts.inter(color: Colors.white, fontSize: 16),
                            ),
                            const SizedBox(height: 24),
                            ElevatedButton.icon(
                              onPressed: _fetchData,
                              icon: const Icon(LucideIcons.refreshCw, size: 16),
                              label: const Text('Retry'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF0AB5CD),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextButton(
                              onPressed: _logout,
                              child: const Text('Logout', style: TextStyle(color: Colors.white54)),
                            ),
                          ],
                        ),
                      ).animate().fade()
                    : RefreshIndicator(
                        onRefresh: _fetchData,
                        color: const Color(0xFF0AB5CD),
                        backgroundColor: const Color(0xFF1E293B),
                        child: ListView(
                          padding: const EdgeInsets.all(24.0),
                          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                          children: [
                            // Header Row
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    if (_user != null && _user!['image'] != null)
                                      Container(
                                        width: 48,
                                        height: 48,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          border: Border.all(color: const Color(0xFF0AB5CD).withOpacity(0.5), width: 2),
                                          image: DecorationImage(
                                            image: CachedNetworkImageProvider(_user!['image']),
                                            fit: BoxFit.cover,
                                          ),
                                        ),
                                      ),
                                    const SizedBox(width: 16),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Welcome back,',
                                          style: GoogleFonts.inter(
                                            fontSize: 13,
                                            color: Colors.white54,
                                          ),
                                        ),
                                        Text(
                                          _user?['name'] ?? 'DJ',
                                          style: GoogleFonts.outfit(
                                            fontSize: 20,
                                            fontWeight: FontWeight.w700,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ).animate().fade().slideX(begin: -0.1),
                                
                                IconButton(
                                  icon: const Icon(LucideIcons.logOut, color: Colors.white54),
                                  onPressed: _logout,
                                  tooltip: 'Logout',
                                ).animate().fade(),
                              ],
                            ),
                            const SizedBox(height: 40),
                            
                            Text(
                              'Dashboard',
                              style: GoogleFonts.outfit(
                                fontSize: 36,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                                letterSpacing: -0.5,
                              ),
                            ).animate().fade(delay: 100.ms).slideY(begin: 0.1),
                            
                            const SizedBox(height: 8),
                            
                            Text(
                              'Your combined listening activity across all platforms.',
                              style: GoogleFonts.inter(
                                fontSize: 15,
                                color: Colors.white54,
                                height: 1.5,
                              ),
                            ).animate().fade(delay: 150.ms).slideY(begin: 0.1),
                            
                            const SizedBox(height: 32),
                            
                            if (_stats != null && _stats!['hasLastfm'] == true)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 16.0),
                                child: _buildStatCard(
                                  'Last.fm Scrobbler',
                                  _stats!['lastfm']['playcount'].toString(),
                                  'Top: ${_stats!['lastfm']['topArtist']} (${_stats!['lastfm']['topArtistPlays']})',
                                  LucideIcons.radio,
                                  const Color(0xFFE31B23), // Last.fm Red
                                  1,
                                ),
                              ),
                              
                            if (_stats != null && _stats!['hasSpotify'] == true)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 16.0),
                                child: _buildStatCard(
                                  'Spotify Tracker',
                                  _stats!['spotify']['playcount'].toString(),
                                  'Top: ${_stats!['spotify']['topArtist']} (${_stats!['spotify']['topArtistPlays']})',
                                  LucideIcons.music,
                                  const Color(0xFF1DB954), // Spotify Green
                                  2,
                                ),
                              ),
                              
                            if (_stats == null || (_stats!['hasLastfm'] == false && _stats!['hasSpotify'] == false))
                              GlassmorphicContainer(
                                width: double.infinity,
                                height: 200,
                                borderRadius: 24,
                                blur: 20,
                                alignment: Alignment.center,
                                border: 1,
                                linearGradient: LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [Colors.white.withOpacity(0.05), Colors.white.withOpacity(0.01)],
                                ),
                                borderGradient: LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [Colors.white.withOpacity(0.1), Colors.transparent],
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(32.0),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(LucideIcons.activity, color: Colors.white.withOpacity(0.2), size: 48),
                                      const SizedBox(height: 16),
                                      Text(
                                        'No stats linked yet.\nConnect Last.fm or Spotify using the Discord Bot.',
                                        textAlign: TextAlign.center,
                                        style: GoogleFonts.inter(color: Colors.white54, height: 1.5, fontSize: 14),
                                      ),
                                    ],
                                  ),
                                ),
                              ).animate().fade(delay: 200.ms).slideY(begin: 0.1),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
