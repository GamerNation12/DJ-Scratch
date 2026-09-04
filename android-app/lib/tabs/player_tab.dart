import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import '../login_screen.dart';

const _baseUrl = 'https://dj-scratch.vercel.app';

String _fmtTime(int ms) {
  final s = ms ~/ 1000;
  final m = s ~/ 60;
  return '$m:${(s % 60).toString().padLeft(2, '0')}';
}

class PlayerTab extends StatefulWidget {
  const PlayerTab({super.key});

  @override
  State<PlayerTab> createState() => _PlayerTabState();
}

class _PlayerTabState extends State<PlayerTab> {
  final storage = const FlutterSecureStorage();
  Map<String, dynamic>? _np;
  bool _isLoading = true;
  bool _notLinked = false;
  String _error = '';
  String _controlError = '';
  String? _busy;
  bool _liked = false;
  int _fetchedAt = 0;
  int _now = 0;
  Timer? _pollTimer;
  Timer? _tickTimer;

  @override
  void initState() {
    super.initState();
    _fetchNowPlaying();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _fetchNowPlaying());
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now().millisecondsSinceEpoch);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    super.dispose();
  }

  Future<Map<String, String>> _authHeaders() async {
    final token = await storage.read(key: 'token');
    return {'Authorization': 'Bearer $token'};
  }

  Future<void> _fetchNowPlaying() async {
    try {
      final res = await http.get(
        Uri.parse('$_baseUrl/api/spotify/now-playing'),
        headers: await _authHeaders(),
      );
      if (!mounted) return;
      if (res.statusCode == 401) {
        // Token dead (rotated secret etc.): drop it and send them to login.
        await storage.delete(key: 'token');
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (_) => false,
        );
        return;
      }
      if (res.statusCode == 404) {
        setState(() { _notLinked = true; _isLoading = false; });
        return;
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (data['error'] == 'not_linked') {
        setState(() { _notLinked = true; _isLoading = false; });
        return;
      }
      if (data['error'] != null) throw Exception(data['error'].toString());
      setState(() {
        _np = data;
        _fetchedAt = DateTime.now().millisecondsSinceEpoch;
        _now = _fetchedAt;
        _liked = data['is_liked'] == true;
        _isLoading = false;
        _error = '';
      });
    } catch (e) {
      if (mounted) setState(() { _error = 'Connection error.'; _isLoading = false; });
    }
  }

  Future<void> _control(String action) async {
    setState(() { _busy = action; _controlError = ''; });
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/api/spotify/control'),
        headers: {...await _authHeaders(), 'Content-Type': 'application/json'},
        body: jsonEncode({'action': action}),
      );
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode != 200) throw Exception(data['error']?.toString() ?? 'Control failed');
      await _fetchNowPlaying();
    } catch (e) {
      if (mounted) setState(() => _controlError = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _toggleLike() async {
    final id = _np?['id'];
    if (id == null) return;
    final action = _liked ? 'unlike' : 'like';
    setState(() => _liked = !_liked); // optimistic
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/api/spotify/like'),
        headers: {...await _authHeaders(), 'Content-Type': 'application/json'},
        body: jsonEncode({'id': id, 'action': action}),
      );
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode != 200) throw Exception(data['error']?.toString() ?? 'Like failed');
      if (data['liked'] is bool && mounted) setState(() => _liked = data['liked'] as bool);
    } catch (e) {
      if (mounted) {
        setState(() => _liked = !_liked); // revert
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  Future<void> _connectSpotify() async {
    try {
      final token = await storage.read(key: 'token');
      String query = '';
      if (token != null) {
        final parts = token.split('.');
        if (parts.length == 3) {
          final payload = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))));
          if (payload['id'] != null) query = '?discord_id=${payload['id']}';
        }
      }
      final url = Uri.parse('$_baseUrl/api/auth/spotify/login$query');
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  Widget _controlButton({required IconData icon, required String tooltip, required VoidCallback? onTap, bool busy = false, Color? color}) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(30),
        child: Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: (color ?? Colors.white).withOpacity(0.07),
            border: Border.all(color: Colors.white.withOpacity(0.1)),
          ),
          child: Center(
            child: busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : Icon(icon, color: color ?? Colors.white, size: 22),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(LucideIcons.music, color: Color(0xFF22C55E), size: 26),
                  const SizedBox(width: 10),
                  Text('Now Playing', style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white)),
                ],
              ),
              const SizedBox(height: 20),
              if (_isLoading)
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(20)),
                  child: const Center(child: CircularProgressIndicator(color: Color(0xFF22C55E))),
                )
              else if (_notLinked)
                _infoCard(
                  icon: LucideIcons.music,
                  title: 'Spotify not linked',
                  body: 'Link Spotify on the website or with ,login in Discord to control playback here.',
                  actionLabel: 'Link Spotify',
                  onAction: _connectSpotify,
                )
              else if (_error.isNotEmpty)
                _infoCard(
                  icon: LucideIcons.alertTriangle,
                  title: 'Something went wrong',
                  body: _error,
                  actionLabel: 'Retry',
                  onAction: () { setState(() { _isLoading = true; _error = ''; }); _fetchNowPlaying(); },
                )
              else if (_np == null || (_np!['is_playing'] != true && _np!['song'] == null))
                _infoCard(
                  icon: LucideIcons.music,
                  title: 'Nothing is playing',
                  body: 'Start playing music on Spotify to see it here.',
                )
              else
                _playerCard(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoCard({required IconData icon, required String title, required String body, String? actionLabel, VoidCallback? onAction}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        children: [
          Icon(icon, size: 48, color: Colors.white54),
          const SizedBox(height: 12),
          Text(title, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white), textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(body, style: GoogleFonts.inter(fontSize: 14, color: Colors.white54), textAlign: TextAlign.center),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: onAction,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF22C55E),
                foregroundColor: Colors.black,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              child: Text(actionLabel, style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _playerCard() {
    final np = _np!;
    final base = (np['progress_ms'] ?? 0) as int;
    final duration = (np['duration_ms'] ?? 0) as int;
    final live = ((np['is_playing'] == true)
        ? (base + (_now - _fetchedAt)).clamp(0, duration == 0 ? base : duration)
        : base).toInt();
    final art = np['album_art'] as String?;
    final spotifyUrl = np['spotify_url'] as String?;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: art != null && art.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: art,
                    width: double.infinity,
                    height: 280,
                    fit: BoxFit.cover,
                    placeholder: (c, u) => Container(height: 280, color: Colors.white.withOpacity(0.05)),
                    errorWidget: (c, u, e) => Container(
                      height: 280,
                      color: Colors.white.withOpacity(0.05),
                      child: const Icon(LucideIcons.music, size: 64, color: Colors.white54),
                    ),
                  )
                : Container(
                    height: 280,
                    color: Colors.white.withOpacity(0.05),
                    child: const Icon(LucideIcons.music, size: 64, color: Colors.white54),
                  ),
          ),
          const SizedBox(height: 16),
          Text(
            (np['song'] ?? 'Unknown') as String,
            style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            (np['artist'] ?? 'Unknown Artist') as String,
            style: GoogleFonts.inter(fontSize: 15, color: Colors.white54),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (np['device'] != null) ...[
            const SizedBox(height: 4),
            Text('🔊 ${np['device']}', style: GoogleFonts.inter(fontSize: 12, color: Colors.white38)),
          ],
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: duration > 0 ? (live / duration).clamp(0.0, 1.0) : 0,
              minHeight: 6,
              backgroundColor: Colors.white.withOpacity(0.1),
              valueColor: const AlwaysStoppedAnimation(Color(0xFF22C55E)),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_fmtTime(live), style: GoogleFonts.inter(fontSize: 12, color: Colors.white54)),
              Text(_fmtTime(duration), style: GoogleFonts.inter(fontSize: 12, color: Colors.white54)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _controlButton(icon: LucideIcons.skipBack, tooltip: 'Previous', onTap: _busy != null ? null : () => _control('previous')),
              const SizedBox(width: 12),
              _controlButton(
                icon: (np['is_playing'] == true) ? LucideIcons.pause : LucideIcons.play,
                tooltip: 'Play/Pause',
                color: const Color(0xFF22C55E),
                busy: _busy == 'play' || _busy == 'pause',
                onTap: _busy != null ? null : () => _control((np['is_playing'] == true) ? 'pause' : 'play'),
              ),
              const SizedBox(width: 12),
              _controlButton(icon: LucideIcons.skipForward, tooltip: 'Next', onTap: _busy != null ? null : () => _control('next')),
              const SizedBox(width: 12),
              _controlButton(
                icon: LucideIcons.heart,
                tooltip: 'Like',
                color: _liked ? const Color(0xFF22C55E) : null,
                onTap: () => _toggleLike(),
              ),
              if (spotifyUrl != null) ...[
                const SizedBox(width: 12),
                _controlButton(
                  icon: LucideIcons.externalLink,
                  tooltip: 'Open in Spotify',
                  onTap: () => launchUrl(Uri.parse(spotifyUrl), mode: LaunchMode.externalApplication),
                ),
              ],
            ],
          ),
          if (_controlError.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.redAccent.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
              ),
              child: Text(_controlError, style: GoogleFonts.inter(fontSize: 13, color: Colors.redAccent), textAlign: TextAlign.center),
            ),
          ],
        ],
      ),
    );
  }
}
