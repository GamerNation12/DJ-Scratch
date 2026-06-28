import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:flutter_animate/flutter_animate.dart';

class AdminTab extends StatefulWidget {
  const AdminTab({super.key});

  @override
  State<AdminTab> createState() => _AdminTabState();
}

class _AdminTabState extends State<AdminTab> {
  final storage = const FlutterSecureStorage();
  bool _isLoading = true;
  String _error = '';
  Map<String, dynamic>? _stats;

  @override
  void initState() {
    super.initState();
    _fetchAdminStats();
  }

  Future<void> _fetchAdminStats() async {
    try {
      final token = await storage.read(key: 'token');
      if (token == null) return;

      final res = await http.get(
        Uri.parse('https://dj-scratch.vercel.app/api/admin/stats'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (res.statusCode == 200) {
        if (mounted) {
          setState(() {
            _stats = jsonDecode(res.body);
            _isLoading = false;
          });
        }
      } else {
        if (mounted) setState(() { _error = 'Failed to load admin stats (${res.statusCode})'; _isLoading = false; });
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Connection error'; _isLoading = false; });
    }
  }

  Widget _buildStatBox(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 28),
          const Spacer(),
          Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: Colors.white70,
            ),
          ),
        ],
      ),
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
          'Admin Dashboard',
          style: GoogleFonts.outfit(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.redAccent))
          : _error.isNotEmpty
              ? Center(child: Text(_error, style: const TextStyle(color: Colors.redAccent)))
              : RefreshIndicator(
                  onRefresh: _fetchAdminStats,
                  color: Colors.redAccent,
                  backgroundColor: const Color(0xFF1E293B),
                  child: ListView(
                    padding: const EdgeInsets.all(24),
                    children: [
                      GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 16,
                        crossAxisSpacing: 16,
                        childAspectRatio: 1.2,
                        children: [
                          _buildStatBox('Total Plays', '${_stats!['totalPlays'] ?? 0}', LucideIcons.playCircle, Colors.greenAccent),
                          _buildStatBox('Total Users', '${_stats!['totalUsers'] ?? 0}', LucideIcons.users, Colors.blueAccent),
                          if (_stats!['botStats'] != null)
                            _buildStatBox('Active Servers', '${_stats!['botStats']['guilds'] ?? 0}', LucideIcons.server, Colors.orangeAccent),
                          if (_stats!['botStats'] != null)
                            _buildStatBox('Active Connections', '${_stats!['botStats']['connections'] ?? 0}', LucideIcons.headphones, Colors.purpleAccent),
                        ],
                      ).animate().fade().slideY(begin: 0.1),
                      const SizedBox(height: 32),
                      if (_stats!['statusActivity'] != null)
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.05),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withOpacity(0.1)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Bot Status Activity',
                                style: GoogleFonts.inter(fontSize: 14, color: Colors.white54, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '${_stats!['statusActivity']}',
                                style: GoogleFonts.outfit(fontSize: 18, color: Colors.white),
                              ),
                            ],
                          ),
                        ).animate().fade(delay: 200.ms),
                    ],
                  ),
                ),
    );
  }
}
