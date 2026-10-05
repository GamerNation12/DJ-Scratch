import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/api_client.dart';
import '../../core/auth_store.dart';
import '../../widgets/states.dart';
import '../../core/config.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});
  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  bool _loading = true;
  String _error = '';
  String _period = 'overall';
  String _query = '';
  Map<String, dynamic>? _stats;
  Map<String, dynamic>? _user;
  Map<String, dynamic>? _rhythm;
  Map<String, dynamic>? _recap;
  String _recapPeriod = 'week';
  bool _recapLoading = false;

  @override
  void initState() {
    super.initState();
    _load();
    // Silent background refresh keeps recents live without a spinner flash.
    _poll = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) _load(silent: true);
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Timer? _poll;

  Future<void> _loadRecap(ApiClient api, String name) async {
    try {
      if (!mounted) return;
      setState(() => _recapLoading = true);
      final data = await api.getJson('/api/recap?user=${Uri.encodeComponent(name)}&period=$_recapPeriod');
      if (!mounted) return;
      if (data['error'] == null) {
        setState(() { _recap = data; _recapLoading = false; });
      } else {
        setState(() { _recap = null; _recapLoading = false; });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() { _recap = null; _recapLoading = false; });
    }
  }

  void _switchRecapPeriod(String v) async {
    if (v == _recapPeriod) return;
    setState(() => _recapPeriod = v);
    try {
      final token = await AuthStore.readToken();
      final user = token == null ? null : AuthStore.decode(token);
      final name = AuthStore.canonicalName((user?['name'] ?? '') as String);
      if (name.isEmpty) return;
      await _loadRecap(ApiClient(token), name);
    } catch (_) { /* keep old recap on failure */ }
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() { _loading = true; _error = ''; });
    try {
      final token = await AuthStore.readToken();
      _user = token == null ? null : AuthStore.decode(token);
      final name = AuthStore.canonicalName((_user?['name'] ?? '') as String);
      if (name.isEmpty) throw ApiException('Not signed in', 401);
      final api = ApiClient(token);
      final data = await api.getJson('/api/u/${Uri.encodeComponent(name)}?period=$_period');
      if (data['error'] != null) throw ApiException(data['error'].toString(), 400);
      if (!mounted) return;
      final statsRaw = (data['stats'] as Map?)?.cast<String, dynamic>();
      final rhythmRaw = (data['rhythm'] as Map?)?.cast<String, dynamic>() ??
          (statsRaw?['rhythm'] as Map?)?.cast<String, dynamic>();
      setState(() { _stats = statsRaw; _rhythm = rhythmRaw; _loading = false; _error = ''; });
      _loadRecap(api, name);
    } on ApiException catch (e) {
      if (!mounted) return;
      // Silent polls never wipe good data with an error screen.
      if (silent) return;
      setState(() { _error = e.message; _loading = false; });
    } catch (_) {
      if (!mounted) return;
      if (silent) return;
      setState(() { _error = 'Connection error.'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: Color(0xFF030712), body: LoadingView());
    if (_error.isNotEmpty) {
      return Scaffold(backgroundColor: const Color(0xFF030712), body: ErrorView(message: _error, onRetry: _load));
    }
    final recents = ((_stats?['recentTracks'] as List?) ?? []).cast<Map>().where((t) {
      if (_query.isEmpty) return true;
      return '${t['name']} ${t['artist']}'.toLowerCase().contains(_query.toLowerCase());
    }).toList();
    final tops = ((_stats?['topArtists'] as List?) ?? []).cast<Map>();

    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          color: const Color(0xFF0AB5CD),
          child: ListView(padding: const EdgeInsets.all(20), children: [
            Row(children: [
              if ((_user?['image'] ?? _user?['avatar']) != null)
                CircleAvatar(
                  backgroundImage: _user!['image'] != null
                      ? CachedNetworkImageProvider(_user!['image'] as String)
                      : null,
                  radius: 22,
                ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Welcome back,', style: GoogleFonts.inter(fontSize: 12, color: Colors.white54)),
                  Text(AuthStore.canonicalName((_user?['name'] ?? 'DJ') as String),
                      style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w700)),
                ]),
              ),
              DropdownButton<String>(
                value: _period,
                dropdownColor: const Color(0xFF0F172A),
                style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                items: AppConfig.periods.map((p) => DropdownMenuItem(value: p, child: Text(p))).toList(),
                onChanged: (v) { if (v != null) { setState(() => _period = v); _load(); } },
              ),
              IconButton(
                icon: const Icon(LucideIcons.share2, color: Colors.white54, size: 20),
                tooltip: 'Copy profile link',
                onPressed: () async {
                  final name = AuthStore.canonicalName((_user?['name'] ?? '') as String);
                  if (name.isEmpty) return;
                  await Clipboard.setData(ClipboardData(text: '${AppConfig.apiBase}/${Uri.encodeComponent(name)}'));
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Profile link copied!'), backgroundColor: Color(0xFF0AB5CD)),
                    );
                  }
                },
              ),
            ]),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(
                child: TextField(
                  onChanged: (v) => setState(() => _query = v),
                  style: GoogleFonts.inter(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'Filter recents…',
                    hintStyle: GoogleFonts.inter(color: Colors.white38),
                    prefixIcon: const Icon(LucideIcons.search, color: Colors.white38, size: 18),
                    filled: true,
                    fillColor: Colors.white.withOpacity(0.05),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  ),
                ),
              ),
            ]),
            const SizedBox(height: 20),
            _statHero(),
            const SizedBox(height: 12),
            _insightsRow(),
            _recapBlock(),
            ..._rhythmBlocks(),
            const SizedBox(height: 24),
            const SectionHeader(title: 'Recent tracks'),
            const SizedBox(height: 12),
            if (recents.isEmpty) const EmptyView(title: 'No tracks found')
            else ...recents.take(8).map(_recentRow),
            const SizedBox(height: 24),
            const SectionHeader(title: 'Top artists'),
            const SizedBox(height: 12),
            SizedBox(
              height: 210,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: tops.length.clamp(0, 10),
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (_, i) => _topCard(tops[i]),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _statHero() {
    final plays = _stats?['playcount'];
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [const Color(0xFF0AB5CD).withOpacity(0.25), Colors.white.withOpacity(0.03)]),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF0AB5CD).withOpacity(0.35)),
      ),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('TOTAL SCROBBLES', style: GoogleFonts.inter(fontSize: 11, color: Colors.white60, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text('${plays ?? '—'}', style: GoogleFonts.outfit(fontSize: 32, fontWeight: FontWeight.w800)),
        ])),
        const Icon(LucideIcons.barChart3, color: Color(0xFF0AB5CD), size: 40),
      ]),
    );
  }

  Widget _insightsRow() {
    final all = ((_stats?['recentTracks'] as List?) ?? []).cast<Map>();
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    final plays24h = all.where((t) {
      final uts = int.tryParse('${t['date'] ?? ''}') ?? 0;
      return t['nowPlaying'] != true && uts > 0 && nowMs - uts * 1000 < 24 * 60 * 60 * 1000;
    }).length;
    final uniqueArtists = all.map((t) => '${t['artist'] ?? ''}'.toLowerCase()).where((s) => s.isNotEmpty).toSet().length;
    final tops = ((_stats?['topArtists'] as List?) ?? []).cast<Map>();
    final total = int.tryParse('${_stats?['playcount'] ?? 0}') ?? 0;
    final topPlays = tops.isEmpty ? 0 : (int.tryParse('${tops.first['playcount'] ?? 0}') ?? 0);
    final share = total > 0 ? (topPlays / total * 100).clamp(0, 100) : 0.0;
    final next = total < 10 ? 10 : _nextPow10(total);

    Widget tile(String label, String value, String sub) {
      return Expanded(
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.04),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.07)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: GoogleFonts.inter(fontSize: 10, color: Colors.white54, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Text(value, style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w800)),
            Text(sub, style: GoogleFonts.inter(fontSize: 11, color: Colors.white54), maxLines: 1, overflow: TextOverflow.ellipsis),
          ]),
        ),
      );
    }

    return Column(children: [
      Row(children: [
        tile('24H PLAYS', '$plays24h', 'scrobbles'),
        const SizedBox(width: 10),
        tile('ROTATION', '$uniqueArtists', 'artists'),
        const SizedBox(width: 10),
        tile('TOP SHARE', '${share.toStringAsFixed(1)}%', tops.isEmpty ? '—' : '${tops.first['name']}'),
      ]),
      const SizedBox(height: 10),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.07)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${(next - total)} PLAYS TO ${(next)}', style: GoogleFonts.inter(fontSize: 10, color: Colors.white54, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (total / next).clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: Colors.white.withOpacity(0.1),
              valueColor: const AlwaysStoppedAnimation(Color(0xFF0AB5CD)),
            ),
          ),
        ]),
      ),
    ]);
  }

  int _nextPow10(int total) {
    var p = 10;
    while (p <= total) {
      p *= 10;
    }
    return p;
  }

  Widget _recapBlock() {
    const accent = Color(0xFF0AB5CD);
    const gold = Color(0xFFF1C40F);
    Widget periodChip(String value, String label) {
      final selected = _recapPeriod == value;
      return GestureDetector(
        onTap: () => _switchRecapPeriod(value),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? accent : Colors.white.withOpacity(0.05),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: selected ? accent : Colors.white.withOpacity(0.1)),
          ),
          child: Text(label,
              style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold,
                  color: selected ? Colors.black : Colors.white70)),
        ),
      );
    }

    Widget trackRows(List items) {
      return Column(children: [
        for (var i = 0; i < items.length && i < 5; i++)
          Builder(builder: (_) {
            final m = (items[i] as Map).cast<String, dynamic>();
            final img = m['image'] as String?;
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: img != null && img.isNotEmpty
                      ? CachedNetworkImage(imageUrl: img, width: 46, height: 46, fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => Container(
                              width: 46, height: 46, color: Colors.white10,
                              child: const Icon(LucideIcons.music, color: Colors.white54, size: 18)))
                      : Container(
                          width: 46, height: 46, color: Colors.white10,
                          child: const Icon(LucideIcons.music, color: Colors.white54, size: 18)),
                ),
                const SizedBox(width: 10),
                Text('${i + 1}',
                    style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white38)),
                const SizedBox(width: 10),
                Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${m['name'] ?? 'Unknown'}',
                      style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text('${m['artist'] ?? ''}',
                      style: GoogleFonts.inter(color: Colors.white54, fontSize: 12),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                ])),
                Text('${m['playcount'] ?? 0}',
                    style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13)),
              ]),
            );
          }),
      ]);
    }

    Widget artistRows(List items) {
      final plays = items.map((e) => _asInt((e as Map)['playcount'])).toList();
      final mx = plays.isEmpty ? 1 : plays.reduce((a, b) => a > b ? a : b).clamp(1, 1 << 30);
      return Column(children: [
        for (var i = 0; i < items.length && i < 5; i++)
          Builder(builder: (_) {
            final m = (items[i] as Map).cast<String, dynamic>();
            final img = m['image'] as String?;
            final pc = _asInt(m['playcount']);
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                ClipOval(
                  child: img != null && img.isNotEmpty
                      ? CachedNetworkImage(imageUrl: img, width: 36, height: 36, fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => Container(
                              width: 36, height: 36, color: Colors.white10,
                              child: const Icon(LucideIcons.music, color: Colors.white54, size: 16)))
                      : Container(
                          width: 36, height: 36, color: Colors.white10,
                          child: const Icon(LucideIcons.music, color: Colors.white54, size: 16)),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: 120,
                  child: Text('${m['name'] ?? 'Unknown'}',
                      style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: (pc / mx).clamp(0.0, 1.0),
                      minHeight: 8,
                      backgroundColor: Colors.white.withOpacity(0.08),
                      valueColor: const AlwaysStoppedAnimation(Color(0xFF0AB5CD)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 36,
                  child: Text('$pc',
                      textAlign: TextAlign.right,
                      style: GoogleFonts.inter(color: Colors.white54, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ]),
            );
          }),
      ]);
    }

    Widget albumRows(List items) {
      return Column(children: [
        for (var i = 0; i < items.length && i < 3; i++)
          Builder(builder: (_) {
            final m = (items[i] as Map).cast<String, dynamic>();
            final img = m['image'] as String?;
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: img != null && img.isNotEmpty
                      ? CachedNetworkImage(imageUrl: img, width: 44, height: 44, fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => Container(
                              width: 44, height: 44, color: Colors.white10,
                              child: const Icon(LucideIcons.music, color: Colors.white54, size: 18)))
                      : Container(
                          width: 44, height: 44, color: Colors.white10,
                          child: const Icon(LucideIcons.music, color: Colors.white54, size: 18)),
                ),
                const SizedBox(width: 10),
                Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${m['name'] ?? 'Unknown'}',
                      style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text('${m['artist'] ?? ''}',
                      style: GoogleFonts.inter(color: Colors.white54, fontSize: 12),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                ])),
                Text('${m['playcount'] ?? 0}',
                    style: GoogleFonts.inter(color: Colors.white54, fontSize: 12, fontWeight: FontWeight.bold)),
              ]),
            );
          }),
      ]);
    }

    Widget sectionLabel(String text, {Color? color}) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(text,
            style: GoogleFonts.inter(
                fontSize: 10, color: color ?? Colors.white38, fontWeight: FontWeight.w800,
                letterSpacing: 1.2)),
      );
    }

    final recap = _recap;
    final total = recap == null ? null : _asInt(recap['total']);
    final capped = recap?['capped'] == true ? '+' : '';
    final discoveries = ((recap?['discoveries'] as List?) ?? []).map((e) => '$e'.trim()).where((s) => s.isNotEmpty).take(5).toList();

    return Column(children: [
      const SizedBox(height: 20),
      const SectionHeader(title: 'Recap'),
      const SizedBox(height: 12),
      IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 5, decoration: const BoxDecoration(color: accent, borderRadius: BorderRadius.horizontal(left: Radius.circular(16)))),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF0E0E12),
                  borderRadius: const BorderRadius.horizontal(right: Radius.circular(16)),
                  border: Border.all(color: Colors.white.withOpacity(0.06)),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text("${recap?['title'] ?? (_recapPeriod == 'month' ? 'YOUR MONTH IN MUSIC' : 'YOUR WEEK IN MUSIC')}",
                            style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w800, color: accent, letterSpacing: 1.1)),
                        const SizedBox(height: 2),
                        Text("${recap?['label'] ?? (_recapPeriod == 'month' ? 'Last 30 days' : 'Last 7 days')}",
                            style: GoogleFonts.inter(fontSize: 12, color: Colors.white54)),
                      ]),
                    ),
                    periodChip('week', 'Week'),
                    const SizedBox(width: 8),
                    periodChip('month', 'Month'),
                  ]),
                  const SizedBox(height: 10),
                  if (_recapLoading)
                    const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(color: accent, strokeWidth: 2)))
                  else if (recap == null)
                    Text("Listen to something this ${_recapPeriod == 'month' ? 'month' : 'week'} and check back.",
                        style: GoogleFonts.inter(fontSize: 12, color: Colors.white38))
                  else ...[
                    Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text('$total$capped',
                          style: GoogleFonts.outfit(fontSize: 44, fontWeight: FontWeight.w800, height: 1.0)),
                      const SizedBox(width: 10),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text('PLAYS',
                            style: GoogleFonts.inter(fontSize: 11, color: Colors.white38, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
                      ),
                    ]),
                    const SizedBox(height: 16),
                    sectionLabel('TOP TRACKS'),
                    trackRows(((recap['topTracks'] as List?) ?? []).toList()),
                    const SizedBox(height: 8),
                    sectionLabel('TOP ARTISTS'),
                    artistRows(((recap['topArtists'] as List?) ?? []).toList()),
                    const SizedBox(height: 8),
                    sectionLabel('TOP ALBUMS'),
                    albumRows(((recap['topAlbums'] as List?) ?? []).toList()),
                    if (discoveries.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      sectionLabel('NEW FINDS', color: gold),
                      Text(discoveries.join('  •  '),
                          style: GoogleFonts.inter(fontSize: 13, color: Colors.white)),
                    ],
                  ],
                ]),
              ),
            ),
          ],
        ),
      ),
    ]);
  }

  int _asInt(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse('$v') ?? 0;
  }

  double _asDouble(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse('$v') ?? 0.0;
  }

  List<Widget> _rhythmBlocks() {
    final r = _rhythm;
    if (r == null) return [];
    final clockRaw = (r['clock'] as List?) ?? [];
    final clock = List<int>.generate(24, (i) {
      if (i < clockRaw.length) {
        final v = _asInt(clockRaw[i]);
        return v < 0 ? 0 : v;
      }
      return 0;
    });
    final clockHas = clock.any((v) => v > 0);

    final dailyRaw = (r['daily'] as List?) ?? [];
    final daily = dailyRaw.whereType<Map>().map((e) {
      final m = e.cast<String, dynamic>();
      return {'date': '${m['date'] ?? ''}', 'plays': _asInt(m['plays']) < 0 ? 0 : _asInt(m['plays'])};
    }).where((d) => (d['date'] as String).isNotEmpty).toList();
    final dailyTrimmed = daily.length > 14 ? daily.sublist(daily.length - 14) : daily;
    final dailyHas = dailyTrimmed.any((d) => (d['plays'] as int) > 0);

    final streak = _asInt(r['streak']);
    final avg = _asDouble(r['avgPerDay']);

    final genresRaw = (r['genres'] as List?) ?? [];
    final genres = genresRaw.whereType<Map>().map((e) {
      final m = e.cast<String, dynamic>();
      final count = _asInt(m['count'] ?? m['plays'] ?? m['playcount']);
      return {'name': '${m['name'] ?? ''}'.trim(), 'count': count < 0 ? 0 : count};
    }).where((g) => (g['name'] as String).isNotEmpty && (g['count'] as int) > 0).take(6).toList();

    final discRaw = (r['discoveries'] as List?) ?? [];
    final seen = <String>{};
    final discoveries = <String>[];
    for (final d in discRaw) {
      final name = '$d'.trim();
      if (name.isEmpty || seen.contains(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      discoveries.add(name);
      if (discoveries.length >= 8) break;
    }

    if (!clockHas && !dailyHas && genres.isEmpty && discoveries.isEmpty && streak <= 0) {
      return [];
    }

    const accent = Color(0xFF0AB5CD);
    final out = <Widget>[];

    // (1) Compact strip: streak + avg/day chips.
    final chips = <Widget>[];
    if (streak > 0) {
      chips.add(_rhythmChip(
        imageUrl: 'https://cdn.discordapp.com/emojis/1551046550862569561.gif',
        label: '$streak day streak${streak == 1 ? '' : 's'}',
      ));
    }
    if (avg > 0) {
      final avgLabel = avg % 1 == 0 ? avg.toStringAsFixed(0) : avg.toStringAsFixed(1);
      chips.add(_rhythmChip(
        icon: LucideIcons.activity,
        iconColor: Colors.greenAccent,
        label: '$avgLabel/day avg',
      ));
    }
    if (chips.isNotEmpty) {
      out.add(const SizedBox(height: 12));
      out.add(Row(
        children: [
          for (var i = 0; i < chips.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            chips[i],
          ],
        ],
      ));
    }

    // (2) Listening clock: 24 bars.
    if (clockHas) {
      final maxClock = clock.reduce((a, b) => a > b ? a : b);
      out.add(const SizedBox(height: 20));
      out.add(const SectionHeader(title: 'Listening clock'));
      out.add(const SizedBox(height: 12));
      out.add(Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.07)),
        ),
        child: Column(children: [
          SizedBox(
            height: 72,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: List.generate(24, (h) {
                final v = clock[h];
                final frac = maxClock > 0 ? v / maxClock : 0.0;
                final isMax = v == maxClock && v > 0;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 1.5),
                    child: Container(
                      height: v <= 0 ? 4 : 6 + frac * 60,
                      decoration: BoxDecoration(
                        color: v <= 0
                            ? Colors.white.withOpacity(0.1)
                            : isMax
                                ? accent
                                : accent.withOpacity(0.35 + 0.4 * frac),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: ['0', '6', '12', '18'].map((h) => Text(
              h,
              style: GoogleFonts.inter(fontSize: 9, color: Colors.white38),
            )).toList(),
          ),
        ]),
      ));
    }

    // (3) Last 14 days: 14 bars with tiny date labels.
    if (dailyHas) {
      final maxDaily = dailyTrimmed.isEmpty ? 0 : dailyTrimmed.map((d) => d['plays'] as int).reduce((a, b) => a > b ? a : b);
      out.add(const SizedBox(height: 20));
      out.add(const SectionHeader(title: 'Last 14 days'));
      out.add(const SizedBox(height: 12));
      out.add(Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.07)),
        ),
        child: Column(children: [
          SizedBox(
            height: 72,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: dailyTrimmed.map((d) {
                final v = d['plays'] as int;
                final frac = maxDaily > 0 ? v / maxDaily : 0.0;
                final isMax = v == maxDaily && v > 0;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Container(
                      height: v <= 0 ? 4 : 6 + frac * 60,
                      decoration: BoxDecoration(
                        color: v <= 0
                            ? Colors.white.withOpacity(0.1)
                            : isMax
                                ? accent
                                : accent.withOpacity(0.35 + 0.4 * frac),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: dailyTrimmed.map((d) {
              final raw = d['date'] as String;
              final day = raw.contains('-') ? raw.split('-').last : raw;
              return Expanded(
                child: Text(
                  day,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                  style: GoogleFonts.inter(fontSize: 8, color: Colors.white38),
                ),
              );
            }).toList(),
          ),
        ]),
      ));
    }

    // (4) Top genres.
    if (genres.isNotEmpty) {
      final maxGenre = (genres.first['count'] as int) <= 0
          ? 1
          : genres.map((g) => g['count'] as int).reduce((a, b) => a > b ? a : b);
      out.add(const SizedBox(height: 20));
      out.add(const SectionHeader(title: 'Top genres'));
      out.add(const SizedBox(height: 12));
      out.add(Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.03),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.07)),
        ),
        child: Column(
          children: [
            for (var i = 0; i < genres.length; i++) ...[
              Row(children: [
                Expanded(
                  child: Text(
                    '${genres[i]['name']}',
                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '${genres[i]['count']}',
                  style: GoogleFonts.inter(fontSize: 12, color: accent),
                ),
              ]),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: (((genres[i]['count'] as int) / maxGenre).clamp(0.0, 1.0)).toDouble(),
                  minHeight: 6,
                  backgroundColor: Colors.white.withOpacity(0.1),
                  valueColor: const AlwaysStoppedAnimation(accent),
                ),
              ),
              if (i < genres.length - 1) const SizedBox(height: 10),
            ],
          ],
        ),
      ));
    }

    // (5) New discoveries.
    if (discoveries.isNotEmpty) {
      out.add(const SizedBox(height: 20));
      out.add(const SectionHeader(title: 'New discoveries'));
      out.add(const SizedBox(height: 12));
      out.add(Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.03),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.07)),
        ),
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          children: discoveries.map((name) => Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withOpacity(0.08)),
            ),
            child: Text(
              name,
              style: GoogleFonts.inter(fontSize: 12, color: Colors.white),
            ),
          )).toList(),
        ),
      ));
    }

    return out;
  }

  Widget _rhythmChip({IconData? icon, Color? iconColor, String? imageUrl, required String label}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.07)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (imageUrl != null)
          Image.network(imageUrl, width: 14, height: 14,
              errorBuilder: (_, __, ___) => const SizedBox.shrink())
        else if (icon != null)
          Icon(icon, size: 14, color: iconColor),
        const SizedBox(width: 6),
        Text(label, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
      ]),
    );
  }

  Widget _recentRow(Map t) {
    final playing = t['nowPlaying'] == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: playing ? const Color(0xFF0AB5CD).withOpacity(0.1) : Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: playing ? const Color(0xFF0AB5CD).withOpacity(0.4) : Colors.white.withOpacity(0.06)),
      ),
      child: Row(children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: t['image'] != null
              ? CachedNetworkImage(imageUrl: t['image'] as String, width: 52, height: 52, fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Container(width: 52, height: 52, color: Colors.white10, child: const Icon(LucideIcons.music, color: Colors.white54)))
              : Container(width: 52, height: 52, color: Colors.white10, child: const Icon(LucideIcons.music, color: Colors.white54)),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${t['name'] ?? 'Unknown'}', style: GoogleFonts.inter(fontWeight: FontWeight.bold), maxLines: 1, overflow: TextOverflow.ellipsis),
          Text('${t['artist'] ?? ''}', style: GoogleFonts.inter(color: Colors.white54, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
        ])),
        if (playing)
          Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: const Color(0xFF0AB5CD), borderRadius: BorderRadius.circular(20)),
              child: const Text('LIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold))),
      ]),
    );
  }

  Widget _topCard(Map item) {
    return Container(
      width: 140,
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.04), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withOpacity(0.08))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          child: item['image'] != null
              ? CachedNetworkImage(imageUrl: item['image'] as String, height: 120, width: 140, fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Container(height: 120, color: Colors.white10, child: const Icon(LucideIcons.music, color: Colors.white54)))
              : Container(height: 120, color: Colors.white10, child: const Icon(LucideIcons.music, color: Colors.white54)),
        ),
        Padding(
          padding: const EdgeInsets.all(10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${item['name'] ?? ''}', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text('${item['playcount'] ?? ''} plays', style: GoogleFonts.inter(color: const Color(0xFF0AB5CD), fontSize: 12)),
          ]),
        ),
      ]),
    );
  }
}
