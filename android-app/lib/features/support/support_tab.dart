import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/api_client.dart';
import '../../widgets/states.dart';

class SupportTab extends StatefulWidget {
  const SupportTab({super.key});
  @override
  State<SupportTab> createState() => _SupportTabState();
}

class _SupportTabState extends State<SupportTab> {
  static const _storageKey = 'support_thread';
  static const _storage = FlutterSecureStorage();

  final _name = TextEditingController();
  final _email = TextEditingController();
  final _firstMessage = TextEditingController();
  final _input = TextEditingController();
  final _scroll = ScrollController();

  String? _threadId;
  String? _secret;
  String _status = '';
  List<Map<String, dynamic>> _messages = [];
  bool _booting = true;
  bool _starting = false;
  bool _sending = false;

  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  @override
  void dispose() {
    _poll?.cancel();
    _name.dispose();
    _email.dispose();
    _firstMessage.dispose();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _restore() async {
    try {
      final raw = await _storage.read(key: _storageKey);
      if (raw != null && raw.isNotEmpty) {
        try {
          final parsed = jsonDecode(raw) as Map<String, dynamic>;
          final id = '${parsed['id'] ?? ''}';
          final secret = '${parsed['secret'] ?? ''}';
          if (id.isNotEmpty && secret.isNotEmpty) {
            _threadId = id;
            _secret = secret;
            await _pollOnce();
            _startPoll();
            if (!mounted) return;
            setState(() => _booting = false);
            _scrollToEnd();
            return;
          }
        } catch (_) {
          await _storage.delete(key: _storageKey);
        }
      }
    } catch (_) {}
    if (mounted) setState(() => _booting = false);
  }

  void _startPoll() {
    _poll?.cancel();
    _poll = Timer.periodic(const Duration(seconds: 4), (_) => _pollOnce());
  }

  Future<void> _persist() async {
    if (_threadId == null || _secret == null) return;
    try {
      await _storage.write(
        key: _storageKey,
        value: jsonEncode({'id': _threadId, 'secret': _secret}),
      );
    } catch (_) {}
  }

  Future<void> _clearThread() async {
    try {
      await _storage.delete(key: _storageKey);
    } catch (_) {}
  }

  Future<void> _start() async {
    final name = _name.text.trim();
    final email = _email.text.trim();
    final message = _firstMessage.text.trim();
    if (name.isEmpty || email.isEmpty || message.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fill in name, email and your message.'), backgroundColor: Colors.redAccent),
      );
      return;
    }
    setState(() => _starting = true);
    try {
      final data = await ApiClient(null).postJson('/api/support-chat', {
        'action': 'start',
        'name': name,
        'email': email,
        'message': message,
      });
      final id = '${data['threadId'] ?? data['thread_id'] ?? data['id'] ?? ''}';
      final secret = '${data['secret'] ?? ''}';
      if (id.isEmpty || secret.isEmpty) throw ApiException('Could not start support thread.', 400);
      _threadId = id;
      _secret = secret;
      await _persist();
      _startPoll();
      await _pollOnce();
      if (mounted) {
        _name.clear();
        _email.clear();
        _firstMessage.clear();
        setState(() {});
        _scrollToEnd();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.redAccent),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Connection error.'), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  Future<void> _pollOnce() async {
    if (_threadId == null || _secret == null) return;
    try {
      final data = await ApiClient(null).postJson('/api/support-chat', {
        'action': 'poll',
        'threadId': _threadId,
        'thread_id': _threadId,
        'secret': _secret,
      });
      if (!mounted) return;
      final msgs = ((data['messages'] as List?) ?? []).map((m) {
        if (m is Map) return (m as Map).cast<String, dynamic>();
        return <String, dynamic>{'body': '$m'};
      }).toList();
      setState(() {
        _messages = msgs;
        _status = '${data['status'] ?? _status}';
      });
    } catch (_) {}
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _threadId == null || _secret == null || _sending) return;
    if (_closed) return;
    _input.clear();
    setState(() => _sending = true);
    try {
      final data = await ApiClient(null).postJson('/api/support-chat', {
        'action': 'send',
        'threadId': _threadId,
        'thread_id': _threadId,
        'secret': _secret,
        'body': text,
      });
      if (!mounted) return;
      final msgs = ((data['messages'] as List?) ?? []);
      if (msgs.isNotEmpty) {
        setState(() {
          _messages = msgs.map((m) {
            if (m is Map) return (m as Map).cast<String, dynamic>();
            return <String, dynamic>{'body': '$m'};
          }).toList();
          if (data['status'] != null) _status = '${data['status']}';
        });
      } else {
        await _pollOnce();
      }
      _scrollToEnd();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.redAccent),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to send.'), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _newConversation() async {
    _poll?.cancel();
    await _clearThread();
    if (!mounted) return;
    setState(() {
      _threadId = null;
      _secret = null;
      _messages = [];
      _status = '';
    });
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      try {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      } catch (_) {}
    });
  }

  bool get _closed => _status.toLowerCase() == 'closed';

  @override
  Widget build(BuildContext context) {
    if (_booting) {
      return const Scaffold(backgroundColor: Color(0xFF030712), body: LoadingView(label: 'Loading support…'));
    }
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Support', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        actions: [
          if (_threadId != null)
            IconButton(
              icon: const Icon(LucideIcons.rotateCcw, color: Colors.white54, size: 20),
              tooltip: 'New conversation',
              onPressed: _newConversation,
            ),
        ],
      ),
      body: _threadId == null ? _startForm() : _chatView(),
    );
  }

  Widget _startForm() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Guest support', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text('Send us a message — no login needed. We reply right here.',
            style: GoogleFonts.inter(color: Colors.white54, fontSize: 13)),
        const SizedBox(height: 20),
        _field(_name, 'Your name'),
        const SizedBox(height: 10),
        _field(_email, 'Email address', keyboard: TextInputType.emailAddress),
        const SizedBox(height: 10),
        _field(_firstMessage, 'How can we help?', maxLines: 5),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _starting ? null : _start,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0AB5CD),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: _starting
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Text('Start chat', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
          ),
        ),
      ],
    );
  }

  Widget _field(TextEditingController c, String hint, {TextInputType? keyboard, int maxLines = 1}) {
    return TextField(
      controller: c,
      keyboardType: keyboard,
      maxLines: maxLines,
      style: GoogleFonts.inter(color: Colors.white),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: GoogleFonts.inter(color: Colors.white38),
        filled: true,
        fillColor: Colors.white.withOpacity(0.05),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
      ),
    );
  }

  Widget _chatView() {
    return Column(
      children: [
        if (_closed)
          Container(
            width: double.infinity,
            margin: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.amber.withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.amber.withOpacity(0.35)),
            ),
            child: Text('This conversation is closed. Start a new one if you need more help.',
                style: GoogleFonts.inter(color: Colors.amber.shade200, fontSize: 13)),
          ),
        Expanded(
          child: _messages.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('No messages yet — say hi!',
                        style: GoogleFonts.inter(color: Colors.white54)),
                  ),
                )
              : ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.all(16),
                  itemCount: _messages.length,
                  itemBuilder: (_, i) {
                    final m = _messages[i];
                    final sender = '${m['sender'] ?? ''}'.toLowerCase();
                    final me = sender == 'visitor' || sender == 'guest' || sender == 'user' || sender == 'you';
                    final body = '${m['body'] ?? m['content'] ?? m['text'] ?? ''}';
                    final created = '${m['created_at'] ?? m['createdAt'] ?? ''}';
                    return Align(
                      alignment: me ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                        decoration: BoxDecoration(
                          color: me
                              ? const Color(0xFF0AB5CD).withOpacity(0.85)
                              : Colors.white.withOpacity(0.07),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(body, style: GoogleFonts.inter(color: Colors.white)),
                            if (created.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(created, style: GoogleFonts.inter(color: Colors.white54, fontSize: 10)),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _input,
                    enabled: !_closed,
                    style: GoogleFonts.inter(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: _closed ? 'Conversation closed' : 'Message…',
                      hintStyle: GoogleFonts.inter(color: Colors.white38),
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.05),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: (_sending || _closed) ? null : _send,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0AB5CD),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: _sending
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Send'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
