import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_animate/flutter_animate.dart';

class LeaderboardTab extends StatefulWidget {
  const LeaderboardTab({super.key});

  @override
  State<LeaderboardTab> createState() => _LeaderboardTabState();
}

class _LeaderboardTabState extends State<LeaderboardTab> {
  bool _isLoading = true;
  String _error = '';
  List<dynamic> _leaderboard = [];

  @override
  void initState() {
    super.initState();
    _fetchLeaderboard();
  }

  Future<void> _fetchLeaderboard() async {
    try {
      final res = await http.get(Uri.parse('https://dj-scratch.vercel.app/api/leaderboard'));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['success'] == true) {
          if (mounted) {
            setState(() {
              _leaderboard = data['leaderboard'] ?? [];
              _isLoading = false;
            });
          }
        } else {
          if (mounted) setState(() { _error = 'Failed to load leaderboard'; _isLoading = false; });
        }
      } else {
        if (mounted) setState(() { _error = 'Server Error ${res.statusCode}'; _isLoading = false; });
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Connection error'; _isLoading = false; });
    }
  }

  Widget _buildTopThree() {
    if (_leaderboard.isEmpty) return const SizedBox();
    
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (_leaderboard.length >= 2) _buildPodiumUser(_leaderboard[1], 2, 120, const Color(0xFFC0C0C0)),
        const SizedBox(width: 16),
        if (_leaderboard.isNotEmpty) _buildPodiumUser(_leaderboard[0], 1, 150, const Color(0xFFFFD700)),
        const SizedBox(width: 16),
        if (_leaderboard.length >= 3) _buildPodiumUser(_leaderboard[2], 3, 100, const Color(0xFFCD7F32)),
      ],
    ).animate().fade().slideY(begin: 0.1);
  }

  Widget _buildPodiumUser(dynamic user, int rank, double height, Color color) {
    return Column(
      children: [
        if (user['avatar'] != null)
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: color, width: 2),
              image: DecorationImage(
                image: CachedNetworkImageProvider(user['avatar']),
                fit: BoxFit.cover,
              ),
            ),
          ),
        const SizedBox(height: 8),
        Text(
          '#$rank',
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        Text(
          user['username'] ?? 'Unknown',
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 8),
        Container(
          width: 80,
          height: height,
          decoration: BoxDecoration(
            color: color.withOpacity(0.15),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            border: Border.all(color: color.withOpacity(0.3)),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.radio, size: 16, color: Colors.white54),
              const SizedBox(height: 4),
              Text(
                '${user['playcount']}',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'Global Leaderboard',
          style: GoogleFonts.outfit(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF0AB5CD)))
          : _error.isNotEmpty
              ? Center(child: Text(_error, style: const TextStyle(color: Colors.redAccent)))
              : RefreshIndicator(
                  onRefresh: _fetchLeaderboard,
                  color: const Color(0xFF0AB5CD),
                  backgroundColor: const Color(0xFF1E293B),
                  child: ListView(
                    padding: const EdgeInsets.all(24),
                    children: [
                      _buildTopThree(),
                      const SizedBox(height: 32),
                      if (_leaderboard.length > 3)
                        ..._leaderboard.sublist(3).asMap().entries.map((entry) {
                          final idx = entry.key;
                          final user = entry.value;
                          final rank = idx + 4;
                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.05),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: Colors.white.withOpacity(0.05)),
                            ),
                            child: Row(
                              children: [
                                Text(
                                  '#$rank',
                                  style: GoogleFonts.outfit(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white54,
                                  ),
                                ),
                                const SizedBox(width: 16),
                                if (user['avatar'] != null)
                                  CircleAvatar(
                                    backgroundImage: CachedNetworkImageProvider(user['avatar']),
                                    radius: 20,
                                  ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Text(
                                    user['username'] ?? 'Unknown',
                                    style: GoogleFonts.inter(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      '${user['playcount']}',
                                      style: GoogleFonts.outfit(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        color: const Color(0xFF0AB5CD),
                                      ),
                                    ),
                                    Text(
                                      'scrobbles',
                                      style: GoogleFonts.inter(
                                        fontSize: 10,
                                        color: Colors.white54,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ).animate().fade(delay: (100 * idx).ms).slideX(begin: 0.1);
                        }).toList(),
                    ],
                  ),
                ),
    );
  }
}
