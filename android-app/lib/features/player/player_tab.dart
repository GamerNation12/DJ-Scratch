import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/api_client.dart';
import '../../core/auth_store.dart';
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
  Timer? _ticker;

  int _progressMs = 0;
  double? _volume;
  bool _shuffle = false;
  String _repeat = 'off';
  bool _seeking = false;
  bool _volumeBusy = false;

  @override
  void initState() {
    super.initState();
    _fetch();
    _poll = Timer.periodic(const Duration(seconds: 8), (_) => _fetch(silent: true));
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  @override
  void dispose() {
    _poll?.cancel();
    _ticker?.cancel();
    super.dispose();
  }

  void _tick() {
    if (!mounted) return;
    if (_seeking) return;
    final np = _np;
    if (np == null || _loading || _notLinked) return;
    if (np['is_playing'] != true) return;
    final dur = _durationMs();
    if (dur <= 0) return;
    if (_progressMs >= dur) return;
    setState(() => _progressMs = (_progressMs + 1000).clamp(0, dur).toInt());
  }

  int _durationMs() {
    final np = _np;
    if (np == null) return 0;
    return (int.tryParse('${np['duration_ms'] ?? 0}') ?? 0);
  }

  void _syncFromPayload(Map<String, dynamic> data) {
    _progressMs = (int.tryParse('${data['progress_ms'] ?? 0}') ?? 0);
    final volRaw = data['volume_percent'] ?? data['volume'];
    if (volRaw != null) {
      final v = double.tryParse('$volRaw');
      if (v != null) _volume = v.clamp(0, 100);
    }
    final sh = data['shuffle_state'] ?? data['shuffle'];
    if (sh is bool) _shuffle = sh;
    final rp = data['repeat_state'] ?? data['repeat'];
    if (rp is String && (rp == 'off' || rp == 'context' || rp == 'track')) {
      _repeat = rp;
    }
  }

  Future<void> _fetch({bool silent = false}) async {
    if (!silent) setState(() { _loading = true; _error = ''; });
    try {
      final token = await AuthStore.readToken();
      final data = await ApiClient(token).getJson('/api/spotify/now-playing');
      if (data['error'] == 'not_linked') {
        if (!mounted) return;
        setState(() { _notLinked = true; _loading = false; });
        return;
      }
      if (data['error'] != null) throw ApiException(data['error'].toString(), 400);
      if (!mounted) return;
      setState(() {
        _np = data;
        _liked = data['is_liked'] == true;
        _syncFromPayload(data);
        _loading = false;
        _error = '';
        _notLinked = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      final msg = e.message.toLowerCase();
      if (e.status == 404 || msg.contains('not_linked') || msg.contains('not linked') || msg.contains('no active')) {
        if (silent && _np != null) return;
        setState(() { _notLinked = e.status == 404 || msg.contains('not_linked') || msg.contains('not linked'); _loading = false; if (!silent) _error = ''; });
        if (!_notLinked && !silent) setState(() => _error = e.message);
        return;
      }
      if (silent) return;
      setState(() { _error = e.message; _loading = false; });
    } catch (_) {
      if (!mounted) return;
      if (!silent) setState(() { _error = 'Connection error.'; _loading = false; });
    }
  }

  Future<void> _control(String action, [Map<String, dynamic>? extra]) async {
    setState(() => _busy = action);
    try {
      final token = await AuthStore.readToken();
      await ApiClient(token).postJson('/api/spotify/control', {'action': action, ...?extra});
      await _fetch(silent: true);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: Colors.redAccent));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Connection error.'), backgroundColor: Colors.redAccent));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _seek(int positionMs) async {
    setState(() { _busy = 'seek'; _seeking = false; });
    try {
      final token = await AuthStore.readToken();
      await ApiClient(token).postJson('/api/spotify/control', {'action': 'seek', 'position_ms': positionMs});
      setState(() => _progressMs = positionMs);
      await _fetch(silent: true);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: Colors.redAccent));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Seek failed.'), backgroundColor: Colors.redAccent));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _setVolume(double v) async {
    setState(() { _volume = v; _volumeBusy = true; });
    try {
      final token = await AuthStore.readToken();
      await ApiClient(token).postJson('/api/spotify/control', {'action': 'volume', 'volume': v.round().clamp(0, 100)});
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: Colors.redAccent));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Volume failed.'), backgroundColor: Colors.redAccent));
    } finally {
      if (mounted) setState(() => _volumeBusy = false);
    }
  }

  Future<void> _toggleShuffle() async {
    final next = !_shuffle;
    setState(() => _shuffle = next);
    try {
      final token = await AuthStore.readToken();
      await ApiClient(token).postJson('/api/spotify/control', {'action': 'shuffle', 'state': next});
      await _fetch(silent: true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _shuffle = !next);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: Colors.redAccent));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _shuffle = !next);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Shuffle failed.'), backgroundColor: Colors.redAccent));
      }
    }
  }

  Future<void> _cycleRepeat() async {
    const order = ['off', 'context', 'track'];
    final idx = order.indexOf(_repeat);
    final next = order[(idx + 1) % order.length];
    final prev = _repeat;
    setState(() => _repeat = next);
    try {
      final token = await AuthStore.readToken();
      await ApiClient(token).postJson('/api/spotify/control', {'action': 'repeat', 'state': next});
      await _fetch(silent: true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _repeat = prev);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: Colors.redAccent));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _repeat = prev);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Repeat failed.'), backgroundColor: Colors.redAccent));
      }
    }
  }

  Future<void> _showDevices() async {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => const Center(child: Padding(
        padding: EdgeInsets.all(24),
        child: CircularProgressIndicator(color: Color(0xFF0AB5CD)),
      )),
    );
    List<Map<String, dynamic>> devices = [];
    String err = '';
    try {
      final token = await AuthStore.readToken();
      final data = await ApiClient(token).getJson('/api/spotify/devices');
      devices = (((data['devices'] as List?) ?? []).map((d) {
        if (d is Map) return (d as Map).cast<String, dynamic>();
        return <String, dynamic>{};
      }).toList());
    } on ApiException catch (e) {
      err = e.message;
    } catch (_) {
      err = 'Connection error.';
    }
    if (!mounted) return;
    Navigator.pop(context);
    if (err.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err), backgroundColor: Colors.redAccent));
      return;
    }
    await showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Devices', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 12),
              if (devices.isEmpty)
                Text('No devices found.', style: GoogleFonts.inter(color: Colors.white54))
              else
                Flexible(
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: devices.length,
                    itemBuilder: (_, i) {
                      final d = devices[i];
                      final active = d['is_active'] == true;
                      return ListTile(
                        leading: Icon(
                          '${d['type']}'.toLowerCase() == 'smartphone' ? LucideIcons.smartphone : LucideIcons.monitor,
                          color: active ? const Color(0xFF22C55E) : Colors.white54,
                        ),
                        title: Text('${d['name'] ?? 'Unknown device'}',
                            style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
                        subtitle: Text(
                          '${d['type'] ?? ''}${d['volume_percent'] != null ? ' · ${d['volume_percent']}%' : ''}',
                          style: GoogleFonts.inter(color: Colors.white54, fontSize: 12),
                        ),
                        trailing: active
                            ? const Icon(LucideIcons.check, color: Color(0xFF22C55E))
                            : null,
                        onTap: () async {
                          Navigator.pop(ctx);
                          await _transfer('${d['id'] ?? ''}');
                        },
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _transfer(String deviceId) async {
    if (deviceId.isEmpty) return;
    setState(() => _busy = 'transfer');
    try {
      final token = await AuthStore.readToken();
      await ApiClient(token).postJson('/api/spotify/control', {
        'action': 'transfer',
        'device_id': deviceId,
        'play': true,
      });
      await _fetch(silent: true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Transferred playback.'), backgroundColor: Color(0xFF0AB5CD)),
        );
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: Colors.redAccent));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Transfer failed.'), backgroundColor: Colors.redAccent));
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
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _liked = !_liked);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: Colors.redAccent));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _liked = !_liked);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Connection error.'), backgroundColor: Colors.redAccent));
      }
    }
  }

  String _fmt(int ms) {
    final s = (ms / 1000).floor();
    final m = s ~/ 60;
    final r = s % 60;
    return '$m:${r.toString().padLeft(2, '0')}';
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
    final dur = _durationMs();
    final progress = dur > 0 ? _progressMs.clamp(0, dur).toInt() : 0;
    final ratio = dur > 0 ? (progress / dur).clamp(0.0, 1.0).toDouble() : 0.0;
    final busy = _busy != null;
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
        if (dur > 0) ...[
          const SizedBox(height: 12),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: const Color(0xFF22C55E),
              inactiveTrackColor: Colors.white10,
              thumbColor: const Color(0xFF22C55E),
              overlayColor: const Color(0xFF22C55E).withOpacity(0.2),
              trackHeight: 6,
            ),
            child: Slider(
              value: progress.toDouble().clamp(0.0, dur.toDouble()).toDouble(),
              min: 0,
              max: dur.toDouble(),
              onChangeStart: (_) => _seeking = true,
              onChanged: (v) => setState(() => _progressMs = v.round()),
              onChangeEnd: (v) => _seek(v.round()),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_fmt(progress), style: GoogleFonts.inter(color: Colors.white54, fontSize: 12)),
              Text(_fmt(dur), style: GoogleFonts.inter(color: Colors.white54, fontSize: 12)),
            ],
          ),
          // Keep the original bar as a thin fallback indicator too.
          const SizedBox(height: 4),
          LinearProgressIndicator(
            value: ratio,
            backgroundColor: Colors.white10,
            color: const Color(0xFF22C55E),
            minHeight: 4,
          ),
        ],
        const SizedBox(height: 14),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          _btn(LucideIcons.shuffle, _toggleShuffle, busy, active: _shuffle),
          const SizedBox(width: 10),
          _btn(LucideIcons.skipBack, () => _control('previous'), busy),
          const SizedBox(width: 10),
          _btn((np['is_playing'] == true) ? LucideIcons.pause : LucideIcons.play, () => _control((np['is_playing'] == true) ? 'pause' : 'play'), busy, accent: true),
          const SizedBox(width: 10),
          _btn(LucideIcons.skipForward, () => _control('next'), busy),
          const SizedBox(width: 10),
          _btn(LucideIcons.heart, _toggleLike, false, active: _liked),
        ]),
        const SizedBox(height: 10),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          _smallBtn(
            LucideIcons.repeat,
            'Repeat: $_repeat',
            _cycleRepeat,
            busy,
            active: _repeat != 'off',
          ),
          const SizedBox(width: 10),
          _smallBtn(LucideIcons.monitor, 'Devices', _showDevices, busy),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          const Icon(LucideIcons.volume1, color: Colors.white54, size: 18),
          Expanded(
            child: SliderTheme(
              data: SliderTheme.of(context).copyWith(
                activeTrackColor: const Color(0xFF0AB5CD),
                inactiveTrackColor: Colors.white10,
                thumbColor: const Color(0xFF0AB5CD),
                overlayColor: const Color(0xFF0AB5CD).withOpacity(0.2),
              ),
              child: Slider(
                value: (_volume ?? 50).clamp(0.0, 100.0).toDouble(),
                min: 0,
                max: 100,
                divisions: 100,
                label: '${((_volume ?? 50).round())}%',
                onChanged: _volumeBusy ? null : (v) => setState(() => _volume = v),
                onChangeEnd: _setVolume,
              ),
            ),
          ),
          const Icon(LucideIcons.volume2, color: Colors.white54, size: 18),
          SizedBox(
            width: 44,
            child: Text('${((_volume ?? 50).round())}%', style: GoogleFonts.inter(color: Colors.white54, fontSize: 12), textAlign: TextAlign.right),
          ),
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

  Widget _smallBtn(IconData icon, String label, VoidCallback onTap, bool disabled, {bool active = false}) {
    return InkWell(
      onTap: disabled ? null : onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: active ? const Color(0xFF0AB5CD).withOpacity(0.18) : Colors.white.withOpacity(0.06),
          border: Border.all(color: active ? const Color(0xFF0AB5CD).withOpacity(0.5) : Colors.white10),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 16, color: active ? const Color(0xFF0AB5CD) : Colors.white70),
          const SizedBox(width: 6),
          Text(label, style: GoogleFonts.inter(fontSize: 12, color: active ? Colors.white : Colors.white70)),
        ]),
      ),
    );
  }
}
