import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api_client.dart';
import '../../core/auth_store.dart';
import '../../widgets/states.dart';

class MessagesTab extends StatefulWidget {
  const MessagesTab({super.key});
  @override
  State<MessagesTab> createState() => _MessagesTabState();
}

class _MessagesTabState extends State<MessagesTab> {
  List<Map> _friends = [];
  Map? _active;
  List<Map> _messages = [];
  String _myId = '';
  final _input = TextEditingController();
  bool _loading = true;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _loadFriends();
  }

  @override
  void dispose() {
    _poll?.cancel();
    _input.dispose();
    super.dispose();
  }

  Future<void> _loadFriends() async {
    try {
      final token = await AuthStore.readToken();
      _myId = (token == null ? null : AuthStore.decode(token)?['id'])?.toString() ?? '';
      final data = await ApiClient(token).getJson('/api/friends');
      if (!mounted) return;
      setState(() {
        _friends = (((data['friends'] as List?) ?? []).cast<Map>()).where((f) => f['status'] == 'accepted').toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMessages() async {
    if (_active == null) return;
    try {
      final token = await AuthStore.readToken();
      final data = await ApiClient(token).getJson('/api/messages/${_active!['friend_id']}');
      if (!mounted) return;
      setState(() => _messages = ((data['messages'] as List?) ?? []).cast<Map>());
    } catch (_) {}
  }

  void _select(Map f) {
    setState(() { _active = f; _messages = []; });
    _loadMessages();
    _poll?.cancel();
    _poll = Timer.periodic(const Duration(seconds: 5), (_) => _loadMessages());
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _active == null) return;
    _input.clear();
    try {
      final token = await AuthStore.readToken();
      final res = await ApiClient(token).postJson('/api/messages/${_active!['friend_id']}', {'content': text});
      if (res['message'] is Map && mounted) {
        setState(() => _messages = [..._messages, (res['message'] as Map).cast<String, dynamic>()]);
      } else {
        await _loadMessages();
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to send'), backgroundColor: Colors.redAccent));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: Color(0xFF030712), body: LoadingView(label: 'Loading chats…'));
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0, title: Text('Messages', style: GoogleFonts.outfit(fontWeight: FontWeight.w700))),
      body: Column(children: [
        SizedBox(
          height: 72,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _friends.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (_, i) {
              final f = _friends[i];
              final sel = _active?['friend_id'] == f['friend_id'];
              final name = '${f['display_name'] ?? f['friend_username']}';
              return ChoiceChip(
                label: Text(name, style: GoogleFonts.inter(color: sel ? Colors.white : Colors.white70)),
                selected: sel,
                selectedColor: const Color(0xFF0AB5CD).withOpacity(0.35),
                backgroundColor: Colors.white.withOpacity(0.05),
                onSelected: (_) => _select(f),
              );
            },
          ),
        ),
        Expanded(
          child: _active == null
              ? const Center(child: EmptyView(title: 'Select a friend to chat'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _messages.length,
                  itemBuilder: (_, i) {
                    final m = _messages[i];
                    final me = _myId.isNotEmpty && '${m['sender_id']}' == _myId || m['mine'] == true;
                    return Align(
                      alignment: me ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                        decoration: BoxDecoration(
                          color: me ? const Color(0xFF0AB5CD).withOpacity(0.85) : Colors.white.withOpacity(0.07),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text('${m['content'] ?? ''}', style: GoogleFonts.inter(color: Colors.white)),
                      ),
                    );
                  },
                ),
        ),
        if (_active != null)
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                Expanded(
                  child: TextField(controller: _input, style: GoogleFonts.inter(color: Colors.white),
                      decoration: InputDecoration(hintText: 'Message…', hintStyle: GoogleFonts.inter(color: Colors.white38),
                          filled: true, fillColor: Colors.white.withOpacity(0.05),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none))),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _send,
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0AB5CD), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                  child: const Text('Send'),
                ),
              ]),
            ),
          ),
      ]),
    );
  }
}
