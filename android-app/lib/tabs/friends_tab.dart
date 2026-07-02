import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons/lucide_icons.dart';

class FriendsTab extends StatefulWidget {
  const FriendsTab({super.key});

  @override
  State<FriendsTab> createState() => _FriendsTabState();
}

class _FriendsTabState extends State<FriendsTab> {
  final storage = const FlutterSecureStorage();
  final TextEditingController _usernameController = TextEditingController();
  List<dynamic> _friends = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchFriends();
  }

  Future<void> _fetchFriends() async {
    try {
      final token = await storage.read(key: 'token');
      if (token == null) return;

      final res = await http.get(
        Uri.parse('https://dj-scratch.vercel.app/api/friends'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (mounted) {
          setState(() {
            _friends = data['friends'] ?? [];
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleAction(String action, {String? targetId, String? targetUsername}) async {
    try {
      final token = await storage.read(key: 'token');
      if (token == null) return;

      final res = await http.post(
        Uri.parse('https://dj-scratch.vercel.app/api/friends'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'action': action,
          'targetId': targetId,
          'targetUsername': targetUsername,
        }),
      );

      final data = jsonDecode(res.body);
      if (data['success'] == true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(action == 'request' ? 'Request sent!' : 'Success!')));
          if (action == 'request') _usernameController.clear();
          _fetchFriends();
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(data['error'] ?? 'An error occurred')));
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to perform action')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF0AB5CD)));
    }

    final pendingIncoming = _friends.where((f) => f['status'] == 'pending' && f['direction'] == 'incoming').toList();
    final pendingOutgoing = _friends.where((f) => f['status'] == 'pending' && f['direction'] == 'outgoing').toList();
    final acceptedFriends = _friends.where((f) => f['status'] == 'accepted').toList();

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Text('Friends', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Add Friend
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.1)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(LucideIcons.userPlus, color: Color(0xFF0AB5CD)),
                    const SizedBox(width: 8),
                    Text('Add a Friend', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _usernameController,
                        decoration: InputDecoration(
                          hintText: 'Discord Username',
                          hintStyle: const TextStyle(color: Colors.white54),
                          filled: true,
                          fillColor: Colors.black.withOpacity(0.3),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () {
                        if (_usernameController.text.isNotEmpty) {
                          _handleAction('request', targetUsername: _usernameController.text);
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0AB5CD),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                      ),
                      child: const Text('Send'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Pending Requests
          if (pendingIncoming.isNotEmpty || pendingOutgoing.isNotEmpty) ...[
            Text('Pending Requests', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...pendingIncoming.map((f) => _buildFriendItem(f, isIncoming: true)),
            ...pendingOutgoing.map((f) => _buildFriendItem(f, isOutgoing: true)),
            const SizedBox(height: 24),
          ],

          // Friends List
          Text('Your Friends', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          if (acceptedFriends.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Text('No friends yet.', style: TextStyle(color: Colors.white54)),
              ),
            )
          else
            ...acceptedFriends.map((f) => _buildFriendItem(f, isFriend: true)),
        ],
      ),
    );
  }

  Widget _buildFriendItem(Map<String, dynamic> f, {bool isIncoming = false, bool isOutgoing = false, bool isFriend = false}) {
    final name = f['display_name'] ?? f['friend_username'];
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.3),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: const Color(0xFF0AB5CD).withOpacity(0.2),
            child: Text(name[0].toUpperCase(), style: const TextStyle(color: Color(0xFF0AB5CD), fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                if (isIncoming) const Text('wants to be friends', style: TextStyle(color: Colors.white54, fontSize: 12)),
                if (isOutgoing) const Text('Request sent', style: TextStyle(color: Colors.white54, fontSize: 12)),
                if (isFriend) Text('@${f['friend_username']}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
              ],
            ),
          ),
          if (isIncoming) ...[
            IconButton(
              icon: const Icon(LucideIcons.check, color: Colors.greenAccent),
              onPressed: () => _handleAction('accept', targetId: f['friend_id']),
            ),
            IconButton(
              icon: const Icon(LucideIcons.x, color: Colors.redAccent),
              onPressed: () => _handleAction('reject', targetId: f['friend_id']),
            ),
          ],
          if (isOutgoing)
            TextButton(
              onPressed: () => _handleAction('remove', targetId: f['friend_id']),
              child: const Text('Cancel', style: TextStyle(color: Colors.redAccent)),
            ),
          if (isFriend)
            IconButton(
              icon: const Icon(LucideIcons.trash2, color: Colors.redAccent),
              onPressed: () => _handleAction('remove', targetId: f['friend_id']),
            ),
        ],
      ),
    );
  }
}
