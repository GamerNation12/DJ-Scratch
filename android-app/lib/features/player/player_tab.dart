import 'dart:async';
import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/api_client.dart';
import '../../core/auth_store.dart';
import '../../core/config.dart';
import '../../widgets/states.dart';

class PlayerTab extends StatefulWidget {
  const PlayerTab({super.key});
  @override
  State<PlayerTab> createState() => _PlayerTabState();
}

class _PlayerTabState extends State<PlayerTab> {
  Map<String, dynamic>? _np;
  bool _loading = true;
  bool _notLinked = false;
  String _error = '';
  String? _busy;
  bool _liked = false;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _fetch();
    _poll = Timer.periodic(const Duration(seconds: 8), (_) => _fetch(silent: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _fetch({bool silent = false}) async {
    if (!silent) setState(() { _loading = true; _error = ''; });
    try {
      final token = await AuthStore.readToken();
      final res = await http.get(Uri.parse('${AppConfig.apiBase}/api/spotify/now-playing'),
          headers: {'Authorization': 'Bearer $token'});
      if (res.statusCode == 404) { setState(() { _notLinked = true; _loading = false; }); return; }
      final data = (jsonDecode(res.body) as Map).cast<String, dynamic>();
      if (data['error'] == 'not_linked') { setState(() { _notLinked = true; _loading = false; }); return; }
      if (data['error'] != null) throw ApiException(data['error'].toString(), 400);
      if (!mounted) return;
      setState(() { _np = data; _liked = data['is_liked'] == true; _loading = false; _error = ''; });
    } catch (_) {
      if (!mounted) return;
      if (!silent) setState(() { _error = 'Connection error.'; _loading = false; });
    }
  }

  Future<void> _control(String action) async {
    setState(() => _busy = action);
    try {
      final token = await AuthStore.readToken();
      await ApiClient(token).postJson('/api/spotify/control', {'action': action});
      await _fetch(silent: true);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: Colors.redAccent));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _toggleLike() async {
    final id = _np?['id'];
    if (id == null) return;
    setState(() => _liked = !_liked);
    try {
      final token = await AuthStore.readToken();
      await ApiClient(token).postJson('/api/spotify/like', {'id': id, 'action': _liked ? 'like' : 'unlike'});
    } catch (_) {
      if (mounted) setState(() => _liked = !_liked);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Now Playing', style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            if (_loading) const LoadingView()
            else if (_notLinked)
              const EmptyView(title: 'Spotify not linked', hint: 'Link Spotify on the website to control playback here.')
            else if (_error.isNotEmpty)
              ErrorView(message: _error, onRetry: () => _fetch())
            else if (_np == null)
              const EmptyView(title: 'Nothing is playing')
            else
              _card(),
          ]),
        ),
      ),
    );
  }

  Widget _card() {
    final np = _np!;
    final art = np['album_art'] as String?;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.04), borderRadius: BorderRadius.circular(24), border: Border.all(color: Colors.white.withOpacity(0.08))),
      child: Column(children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: art != null && art.isNotEmpty
              ? CachedNetworkImage(imageUrl: art, height: 260, width: double.infinity, fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Container(height: 260, color: Colors.white10, child: const Icon(LucideIcons.music, size: 64, color: Colors.white54)))
              : Container(height: 260, color: Colors.white10, child: const Icon(LucideIcons.music, size: 64, color: Colors.white54)),
        ),
        const SizedBox(height: 14),
        Text('${np['song'] ?? 'Unknown'}', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w800), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
        Text('${np['artist'] ?? ''}', style: GoogleFonts.inter(color: Colors.white54)),
        if (np['progress_ms'] != null && np['duration_ms'] != null && (np['duration_ms'] as int) > 0) ...[
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: ((np['progress_ms'] as int) / (np['duration_ms'] as int)).clamp(0.0, 1.0),
            backgroundColor: Colors.white10,
            color: const Color(0xFF22C55E),
            minHeight: 6,
          ),
        ],
        const SizedBox(height: 14),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          _btn(LucideIcons.skipBack, () => _control('previous'), _busy != null),
          const SizedBox(width: 10),
          _btn((np['is_playing'] == true) ? LucideIcons.pause : LucideIcons.play, () => _control((np['is_playing'] == true) ? 'pause' : 'play'), _busy != null, accent: true),
          const SizedBox(width: 10),
          _btn(LucideIcons.skipForward, () => _control('next'), _busy != null),
          const SizedBox(width: 10),
          _btn(LucideIcons.heart, _toggleLike, false, active: _liked),
        ]),
      ]),
    );
  }

  Widget _btn(IconData icon, VoidCallback onTap, bool disabled, {bool accent = false, bool active = false}) {
    return InkWell(
      onTap: disabled ? null : onTap,
      borderRadius: BorderRadius.circular(30),
      child: Container(
        width: 52, height: 52,
        decoration: BoxDecoration(shape: BoxShape.circle, color: accent ? const Color(0xFF22C55E) : Colors.white.withOpacity(0.07), border: Border.all(color: Colors.white10)),
        child: Icon(icon, color: accent ? Colors.black : (active ? const Color(0xFF22C55E) : Colors.white)),
      ),
    );
  }
}
