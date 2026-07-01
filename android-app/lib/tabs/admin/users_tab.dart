import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';

class AdminUsersTab extends StatefulWidget {
  const AdminUsersTab({super.key});
  @override
  State<AdminUsersTab> createState() => _AdminUsersTabState();
}

class _AdminUsersTabState extends State<AdminUsersTab> {
  final storage = const FlutterSecureStorage();
  bool _isLoading = true;
  List<dynamic> users = [];

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  Future<void> _fetchUsers() async {
    final token = await storage.read(key: 'token');
    if (token == null) return;
    try {
      final res = await http.get(
        Uri.parse('https://dj-scratch.vercel.app/api/admin/users'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200 && mounted) {
        setState(() {
          users = jsonDecode(res.body)['users'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _userAction(String userId, String action, [Map<String, dynamic> payload = const {}]) async {
    final token = await storage.read(key: 'token');
    await http.post(
      Uri.parse('https://dj-scratch.vercel.app/api/admin/users/action'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode({'userId': userId, 'actionType': action, 'payload': payload}),
    );
    _fetchUsers();
  }

  void _showBanDialog(String userId) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: const Color(0xFF18181B),
        title: const Text('Ban User', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: ctrl,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(hintText: 'Reason', hintStyle: TextStyle(color: Colors.white54)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
          TextButton(onPressed: () {
            Navigator.pop(c);
            _userAction(userId, 'BAN', {'reason': ctrl.text});
          }, child: const Text('Ban', style: TextStyle(color: Colors.redAccent))),
        ],
      )
    );
  }

  void _showEditNameDialog(String userId, String currentName) {
    final ctrl = TextEditingController(text: currentName);
    showDialog(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: const Color(0xFF18181B),
        title: const Text('Edit Display Name', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: ctrl,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(hintText: 'Display Name', hintStyle: TextStyle(color: Colors.white54)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
          TextButton(onPressed: () {
            Navigator.pop(c);
            _userAction(userId, 'EDIT_NAME', {'displayName': ctrl.text.isEmpty ? null : ctrl.text});
          }, child: const Text('Save', style: TextStyle(color: Colors.indigoAccent))),
        ],
      )
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator(color: Colors.indigoAccent));

    return ListView.separated(
      padding: const EdgeInsets.all(20),
      itemCount: users.length,
      separatorBuilder: (c, i) => const SizedBox(height: 16),
      itemBuilder: (context, index) {
        final u = users[index];
        final isBanned = u['is_banned'] == true;
        
        return Container(
          padding: const EdgeInsets.all(16),
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
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(u['discord_username'] ?? 'Unknown', style: GoogleFonts.robotoMono(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                        Text(u['user_id'], style: const TextStyle(fontSize: 10, color: Colors.white54)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: (isBanned ? Colors.redAccent : Colors.greenAccent).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: (isBanned ? Colors.redAccent : Colors.greenAccent).withOpacity(0.3)),
                    ),
                    child: Text(
                      isBanned ? 'BANNED' : 'ACTIVE',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: isBanned ? Colors.redAccent : Colors.greenAccent),
                    ),
                  )
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: Text('Display: ${u['display_name'] ?? '-'}', style: const TextStyle(color: Colors.white70, fontSize: 12))),
                  Expanded(child: Text('Last.fm: ${u['lastfm_username'] ?? '-'}', style: const TextStyle(color: Colors.white70, fontSize: 12))),
                ],
              ),
              const SizedBox(height: 16),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    if (isBanned)
                      ElevatedButton(
                        onPressed: () => _userAction(u['user_id'], 'UNBAN'),
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.grey[800], padding: const EdgeInsets.symmetric(horizontal: 12)),
                        child: const Text('Unban', style: TextStyle(color: Colors.white)),
                      )
                    else
                      ElevatedButton(
                        onPressed: () => _showBanDialog(u['user_id']),
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent.withOpacity(0.2), foregroundColor: Colors.redAccent, elevation: 0),
                        child: const Text('Ban'),
                      ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () => _showEditNameDialog(u['user_id'], u['display_name'] ?? ''),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.indigoAccent.withOpacity(0.2), foregroundColor: Colors.indigoAccent, elevation: 0),
                      child: const Text('Edit Name'),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () {
                        // Normally would show confirm dialog
                        _userAction(u['user_id'], 'RESET');
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.orangeAccent.withOpacity(0.2), foregroundColor: Colors.orangeAccent, elevation: 0),
                      child: const Text('Reset'),
                    ),
                  ],
                ),
              )
            ],
          ),
        );
      },
    );
  }
}
