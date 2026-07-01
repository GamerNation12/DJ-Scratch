import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

class AdminOverviewTab extends StatefulWidget {
  const AdminOverviewTab({super.key});
  @override
  State<AdminOverviewTab> createState() => _AdminOverviewTabState();
}

class _AdminOverviewTabState extends State<AdminOverviewTab> {
  final storage = const FlutterSecureStorage();
  bool _isLoading = true;
  Map<String, dynamic>? _stats;

  @override
  void initState() {
    super.initState();
    _fetchStats();
  }

  Future<void> _fetchStats() async {
    final token = await storage.read(key: 'token');
    if (token == null) return;
    try {
      final res = await http.get(
        Uri.parse('https://dj-scratch.vercel.app/api/admin/stats'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200 && mounted) {
        setState(() {
          _stats = jsonDecode(res.body);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF18181B).withOpacity(0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title.toUpperCase(), style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white54)),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, color: color, size: 20),
              ),
            ],
          ),
          const Spacer(),
          Text(value, style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator(color: Colors.indigoAccent));
    if (_stats == null) return const Center(child: Text("Failed to load", style: TextStyle(color: Colors.white)));

    final commandUsage = _stats!['commandUsage'] as List? ?? [];
    
    return RefreshIndicator(
      onRefresh: _fetchStats,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 16,
            crossAxisSpacing: 16,
            childAspectRatio: 1.2,
            children: [
              _buildStatCard('Total Scrobbles', '${_stats!['totalPlays'] ?? 0}', LucideIcons.music, Colors.indigoAccent),
              _buildStatCard('Imported Users', '${_stats!['totalUsers'] ?? 0}', LucideIcons.users, Colors.purpleAccent),
              _buildStatCard('Active Guilds', '${_stats!['botStats']?['server_count'] ?? 0}', LucideIcons.server, Colors.tealAccent),
              _buildStatCard('Total Members', '${_stats!['botStats']?['member_count'] ?? 0}', LucideIcons.globe, Colors.amberAccent),
            ],
          ),
          const SizedBox(height: 24),
          Text("Command Usage", style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF18181B).withOpacity(0.5),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.05)),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: commandUsage.length,
              separatorBuilder: (c, i) => Divider(color: Colors.white.withOpacity(0.05), height: 1),
              itemBuilder: (context, index) {
                final cmd = commandUsage[index];
                return ListTile(
                  title: Text('/${cmd['command_name']}', style: GoogleFonts.mono(color: Colors.indigoAccent, fontWeight: FontWeight.bold)),
                  trailing: Text('${cmd['usage_count']} uses', style: GoogleFonts.inter(color: Colors.white54, fontSize: 13)),
                );
              },
            ),
          )
        ],
      ),
    );
  }
}
