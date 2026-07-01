import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';

class AdminSystemTab extends StatefulWidget {
  const AdminSystemTab({super.key});
  @override
  State<AdminSystemTab> createState() => _AdminSystemTabState();
}

class _AdminSystemTabState extends State<AdminSystemTab> {
  final storage = const FlutterSecureStorage();

  Future<void> _runAction(String actionType, [Map<String, dynamic> payload = const {}]) async {
    final token = await storage.read(key: 'token');
    if (token == null) return;
    
    try {
      final res = await http.post(
        Uri.parse('https://dj-scratch.vercel.app/api/admin/action'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({'actionType': actionType, 'payload': payload}),
      );
      if (res.statusCode == 200) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Action successful')));
      } else {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Action failed')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Action error')));
    }
  }

  Widget _buildActionCard(String title, String desc, IconData icon, Color color, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF18181B).withOpacity(0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: color),
          ),
          const SizedBox(height: 16),
          Text(title, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 8),
          Text(desc, style: const TextStyle(color: Colors.white54, fontSize: 13)),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: color.withOpacity(0.2),
                foregroundColor: color,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Execute', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _buildActionCard(
          'Sync Slash Commands', 
          'Force an update of Discord global slash commands.', 
          Icons.sync, 
          Colors.indigoAccent,
          () => _runAction('SYNC_COMMANDS')
        ),
        _buildActionCard(
          'Restart Bot Instance', 
          'Send a signal to reboot the bot safely.', 
          Icons.power_settings_new, 
          Colors.redAccent,
          () => _runAction('RESTART_BOT')
        ),
        _buildActionCard(
          'Renew Host Server', 
          'Add 24 hours to your free bot hosting.', 
          Icons.cloud_upload, 
          Colors.pinkAccent,
          () => _runAction('RENEW_HOST_SERVER')
        ),
      ],
    );
  }
}
