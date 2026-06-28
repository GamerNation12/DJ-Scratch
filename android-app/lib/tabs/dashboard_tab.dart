import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:cached_network_image/cached_network_image.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
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
      if (token == null) return;

      final parts = token.split('.');
      if (parts.length == 3) {
        final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
        if (mounted) setState(() => _user = jsonDecode(payload));
      }

      final response = await http.get(
        Uri.parse('https://dj-scratch.vercel.app/api/mobile/stats'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          if (mounted) {
            setState(() {
              _stats = data['stats'];
              _isLoading = false;
            });
          }
        } else {
          if (mounted) setState(() { _error = data['error'] ?? 'Failed to load stats'; _isLoading = false; });
        }
      } else {
        if (mounted) setState(() { _error = 'Server error: ${response.statusCode}'; _isLoading = false; });
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Connection error.'; _isLoading = false; });
    }
  }

  Widget _buildTopItem(dynamic item, int index) {
    return Container(
      width: 140,
      margin: const EdgeInsets.only(right: 16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 140,
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              image: item['image'] != null
                  ? DecorationImage(image: CachedNetworkImageProvider(item['image']), fit: BoxFit.cover)
                  : null,
              color: const Color(0xFF1E293B),
            ),
            child: item['image'] == null ? const Center(child: Icon(LucideIcons.music, color: Colors.white54)) : null,
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item['name'] ?? 'Unknown',
                  style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (item['artist'] != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    item['artist'],
                    style: GoogleFonts.inter(fontSize: 12, color: Colors.white54),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 6),
                Text(
                  '${item['playcount'] ?? 0} plays',
                  style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF0AB5CD), fontWeight: FontWeight.w600),
                ),
              ],
            ),
          )
        ],
      ),
    ).animate().fade(delay: (index * 100).ms).slideX(begin: 0.1);
  }

  Widget _buildRecentTrack(dynamic track, int index) {
    final isPlaying = track['nowPlaying'] == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isPlaying ? const Color(0xFF0AB5CD).withOpacity(0.1) : Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isPlaying ? const Color(0xFF0AB5CD).withOpacity(0.5) : Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              image: track['image'] != null
                  ? DecorationImage(image: CachedNetworkImageProvider(track['image']), fit: BoxFit.cover)
                  : null,
              color: const Color(0xFF1E293B),
            ),
            child: track['image'] == null ? const Icon(LucideIcons.music, color: Colors.white54) : null,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  track['name'] ?? 'Unknown',
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  track['artist'] ?? 'Unknown Artist',
                  style: GoogleFonts.inter(fontSize: 13, color: Colors.white54),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (isPlaying)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: const Color(0xFF0AB5CD), borderRadius: BorderRadius.circular(20)),
              child: const Text('Playing', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
            ).animate(onPlay: (c) => c.repeat(reverse: true)).fade(begin: 0.5, end: 1.0)
        ],
      ),
    ).animate().fade(delay: (index * 50).ms).slideX(begin: 0.1);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF0AB5CD)))
            : _error.isNotEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(LucideIcons.alertCircle, color: Colors.redAccent, size: 48),
                        const SizedBox(height: 16),
                        Text(_error, style: const TextStyle(color: Colors.white)),
                        const SizedBox(height: 24),
                        ElevatedButton(onPressed: _fetchData, child: const Text('Retry'))
                      ],
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _fetchData,
                    color: const Color(0xFF0AB5CD),
                    backgroundColor: const Color(0xFF1E293B),
                    child: ListView(
                      padding: const EdgeInsets.all(24),
                      children: [
                        // Header
                        Row(
                          children: [
                            if (_user != null && _user!['image'] != null)
                              CircleAvatar(backgroundImage: CachedNetworkImageProvider(_user!['image']), radius: 24),
                            const SizedBox(width: 16),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Welcome back,', style: GoogleFonts.inter(fontSize: 13, color: Colors.white54)),
                                Text(_user?['name'] ?? 'DJ', style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.w700, color: Colors.white)),
                              ],
                            ),
                          ],
                        ).animate().fade().slideX(begin: -0.1),
                        const SizedBox(height: 32),

                        // Now Playing & Recent
                        Text('Recent Tracks', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
                        const SizedBox(height: 16),
                        if (_stats!['recentTracks'] != null)
                          ...(_stats!['recentTracks'] as List).take(5).toList().asMap().entries.map(
                                (entry) => _buildRecentTrack(entry.value, entry.key),
                              ),
                        
                        const SizedBox(height: 32),

                        // Top Artists
                        Text('Top Artists', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
                        const SizedBox(height: 16),
                        if (_stats!['topArtists'] != null)
                          SizedBox(
                            height: 230,
                            child: ListView.builder(
                              scrollDirection: Axis.horizontal,
                              itemCount: (_stats!['topArtists'] as List).length,
                              itemBuilder: (context, index) => _buildTopItem(_stats!['topArtists'][index], index),
                            ),
                          ),

                        const SizedBox(height: 32),

                        // Top Tracks
                        Text('Top Tracks', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
                        const SizedBox(height: 16),
                        if (_stats!['topTracks'] != null)
                          SizedBox(
                            height: 230,
                            child: ListView.builder(
                              scrollDirection: Axis.horizontal,
                              itemCount: (_stats!['topTracks'] as List).length,
                              itemBuilder: (context, index) => _buildTopItem(_stats!['topTracks'][index], index),
                            ),
                          ),
                      ],
                    ),
                  ),
      ),
    );
  }
}
