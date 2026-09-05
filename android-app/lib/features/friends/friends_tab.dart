import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/api_client.dart';
import '../../core/auth_store.dart';
import '../../widgets/states.dart';

class FriendsTab extends StatefulWidget {
  const FriendsTab({super.key});
  @override
  State<FriendsTab> createState() => _FriendsTabState();
}

class _FriendsTabState extends State<FriendsTab> {
  bool _loading = true;
  final _name = TextEditingController();
  List<Map> _friends = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final token = await AuthStore.readToken();
      final data = await ApiClient(token).getJson('/api/friends');
      if (!mounted) return;
      setState(() { _friends = ((data['friends'] as List?) ?? []).cast<Map>(); _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.redAccent));
    }
  }

  Future<void> _act(String action, {String? targetId, String? targetUsername}) async {
    try {
      final token = await AuthStore.readToken();
      await ApiClient(token).postJson('/api/friends', {
        'action': action,
        if (targetId != null) 'targetId': targetId,
        if (targetUsername != null) 'targetUsername': targetUsername,
      });
      _name.clear();
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.redAccent));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: Color(0xFF030712), body: LoadingView(label: 'Loading friends…'));
    final incoming = _friends.where((f) => f['status'] == 'pending' && f['direction'] == 'incoming').toList();
    final accepted = _friends.where((f) => f['status'] == 'accepted').toList();
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0, title: Text('Friends', style: GoogleFonts.outfit(fontWeight: FontWeight.w700))),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(20), children: [
          Row(children: [
            Expanded(
              child: TextField(controller: _name, style: GoogleFonts.inter(color: Colors.white),
                  decoration: InputDecoration(hintText: 'Discord username', hintStyle: GoogleFonts.inter(color: Colors.white38),
                      filled: true, fillColor: Colors.white.withOpacity(0.05),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none))),
            ),
            const SizedBox(width: 10),
            ElevatedButton(
              onPressed: () => _act('request', targetUsername: _name.text.trim()),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0AB5CD), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              child: const Icon(LucideIcons.userPlus),
            ),
          ]),
          if (incoming.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text('Requests (${incoming.length})', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            ...incoming.map((f) => _row(
                  '${f['display_name'] ?? f['friend_username']}',
                  actions: [
                    TextButton(onPressed: () => _act('accept', targetId: '${f['friend_id']}'), child: const Text('Accept')),
                    TextButton(onPressed: () => _act('reject', targetId: '${f['friend_id']}'), child: const Text('Decline', style: TextStyle(color: Colors.redAccent))),
                  ],
                )),
          ],
          const SizedBox(height: 20),
          Text('Your friends (${accepted.length})', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          if (accepted.isEmpty) const EmptyView(title: 'No friends yet', hint: 'Send a request above.')
          else ...accepted.map((f) => _row(
                '${f['display_name'] ?? f['friend_username']}',
                sub: '@${f['friend_username']}',
                actions: [IconButton(icon: const Icon(LucideIcons.trash2, color: Colors.redAccent, size: 18), onPressed: () => _act('remove', targetId: '${f['friend_id']}'))],
              )),
        ]),
      ),
    );
  }

  Widget _row(String title, {String? sub, List<Widget> actions = const []}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.04), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withOpacity(0.06))),
      child: Row(children: [
        CircleAvatar(backgroundColor: const Color(0xFF0AB5CD).withOpacity(0.2), child: Text(title.isEmpty ? '?' : title[0].toUpperCase())),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
          if (sub != null) Text(sub, style: GoogleFonts.inter(color: Colors.white54, fontSize: 12)),
        ])),
        ...actions,
      ]),
    );
  }
}
