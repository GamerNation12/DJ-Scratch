import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/api_client.dart';
import '../../core/auth_store.dart';
import '../../widgets/states.dart';

class ToolsTab extends StatefulWidget {
  const ToolsTab({super.key});
  @override
  State<ToolsTab> createState() => _ToolsTabState();
}

class _ToolsTabState extends State<ToolsTab> {
  // ---- WhoKnows ----
  String _wkKind = 'artist';
  final _wkArtist = TextEditingController();
  final _wkExtra = TextEditingController();
  List<String> _suggestions = [];
  bool _wkLoading = false;
  bool _wkSearched = false;
  String _wkTitle = '';
  List<Map<String, dynamic>> _wkRows = [];
  Timer? _acDebounce;

  // ---- Pace ----
  final _paceUser = TextEditingController();
  final _paceGoal = TextEditingController();
  bool _paceLoading = false;
  Map<String, dynamic>? _pace;

  // ---- Taste ----
  final _tasteA = TextEditingController();
  final _tasteB = TextEditingController();
  bool _tasteLoading = false;
  Map<String, dynamic>? _taste;

  @override
  void dispose() {
    _wkArtist.dispose();
    _wkExtra.dispose();
    _paceUser.dispose();
    _paceGoal.dispose();
    _tasteA.dispose();
    _tasteB.dispose();
    _acDebounce?.cancel();
    super.dispose();
  }

  Future<ApiClient> _api() async {
    final token = await AuthStore.readToken();
    return ApiClient(token);
  }

  void _snack(String msg, {bool error = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: GoogleFonts.inter()),
        backgroundColor: error ? Colors.redAccent : const Color(0xFF0AB5CD),
      ),
    );
  }

  // ---------- WhoKnows ----------
  String get _wkExtraLabel => _wkKind == 'track' ? 'Track (optional)' : _wkKind == 'album' ? 'Album (optional)' : 'Track / Album (optional)';

  void _onWkQueryChanged(String v) {
    _acDebounce?.cancel();
    final q = v.trim();
    if (q.length < 2) {
      if (mounted) setState(() => _suggestions = []);
      return;
    }
    _acDebounce = Timer(const Duration(milliseconds: 400), () => _fetchAutocomplete(q));
  }

  Future<void> _fetchAutocomplete(String q) async {
    try {
      final api = await _api();
      final data = await api.getJson(
        '/api/tools/autocomplete?kind=${Uri.encodeComponent(_wkKind)}&q=${Uri.encodeComponent(q)}',
      );
      final list = _stringList(data['suggestions'] ?? data['results'] ?? data['items'] ?? data['names']);
      if (!mounted) return;
      setState(() => _suggestions = list.take(6).toList());
    } catch (_) {}
  }

  List<String> _stringList(dynamic raw) {
    if (raw is! List) return [];
    return raw.map((e) {
      if (e is String) return e;
      if (e is Map) {
        for (final k in ['name', 'title', 'value', 'label']) {
          if (e[k] != null) return '${e[k]}';
        }
        return '';
      }
      return '$e';
    }).where((s) => s.isNotEmpty).toList();
  }

  Future<void> _searchWhoKnows() async {
    final artist = _wkArtist.text.trim();
    if (artist.isEmpty) {
      _snack('Enter an artist name.');
      return;
    }
    setState(() { _wkLoading = true; _wkSearched = false; });
    try {
      final api = await _api();
      final extra = _wkExtra.text.trim();
      final buf = StringBuffer('/api/tools/whoknows?kind=${Uri.encodeComponent(_wkKind)}&artist=${Uri.encodeComponent(artist)}');
      if (extra.isNotEmpty) {
        if (_wkKind == 'album') {
          buf.write('&album=${Uri.encodeComponent(extra)}');
        } else {
          buf.write('&track=${Uri.encodeComponent(extra)}');
        }
      }
      final data = await api.getJson(buf.toString());
      if (!mounted) return;
      final lb = ((data['leaderboard'] as List?) ?? []).map((e) {
        if (e is Map) return (e as Map).cast<String, dynamic>();
        return <String, dynamic>{'name': '$e'};
      }).toList();
      setState(() {
        _wkRows = lb;
        _wkSearched = true;
        final shownArtist = '${data['artist'] ?? artist}';
        _wkTitle = shownArtist;
        _wkLoading = false;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _wkLoading = false);
      _snack(e.message);
    } catch (_) {
      if (mounted) setState(() => _wkLoading = false);
      _snack('Connection error.');
    }
  }

  // ---------- Pace ----------
  Future<void> _searchPace() async {
    final user = _paceUser.text.trim();
    if (user.isEmpty) {
      _snack('Enter a Last.fm username.');
      return;
    }
    setState(() => _paceLoading = true);
    try {
      final api = await _api();
      final goal = _paceGoal.text.trim();
      var path = '/api/tools/pace?user=${Uri.encodeComponent(user)}';
      if (goal.isNotEmpty) path += '&goal=${Uri.encodeComponent(goal)}';
      final data = await api.getJson(path);
      if (!mounted) return;
      setState(() { _pace = data; _paceLoading = false; });
    } on ApiException catch (e) {
      if (mounted) setState(() => _paceLoading = false);
      _snack(e.message);
    } catch (_) {
      if (mounted) setState(() => _paceLoading = false);
      _snack('Connection error.');
    }
  }

  // ---------- Taste ----------
  Future<void> _searchTaste() async {
    final a = _tasteA.text.trim();
    final b = _tasteB.text.trim();
    if (a.isEmpty || b.isEmpty) {
      _snack('Enter both usernames.');
      return;
    }
    setState(() => _tasteLoading = true);
    try {
      final api = await _api();
      final data = await api.getJson(
        '/api/tools/taste?a=${Uri.encodeComponent(a)}&b=${Uri.encodeComponent(b)}',
      );
      if (!mounted) return;
      setState(() { _taste = data; _tasteLoading = false; });
    } on ApiException catch (e) {
      if (mounted) setState(() => _tasteLoading = false);
      _snack(e.message);
    } catch (_) {
      if (mounted) setState(() => _tasteLoading = false);
      _snack('Connection error.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Tools', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SectionHeader(title: 'WhoKnows'),
          const SizedBox(height: 10),
          _card(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DropdownButtonFormField<String>(
                value: _wkKind,
                dropdownColor: const Color(0xFF0F172A),
                style: GoogleFonts.inter(color: Colors.white),
                decoration: _fieldDec('Kind'),
                items: const [
                  DropdownMenuItem(value: 'artist', child: Text('Artist')),
                  DropdownMenuItem(value: 'track', child: Text('Track')),
                  DropdownMenuItem(value: 'album', child: Text('Album')),
                ],
                onChanged: (v) {
                  if (v == null) return;
                  setState(() { _wkKind = v; _suggestions = []; });
                },
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _wkArtist,
                onChanged: _onWkQueryChanged,
                style: GoogleFonts.inter(color: Colors.white),
                decoration: _fieldDec('Artist'),
              ),
              if (_suggestions.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _suggestions.map((s) => GestureDetector(
                    onTap: () {
                      _wkArtist.text = s;
                      setState(() => _suggestions = []);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0AB5CD).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFF0AB5CD).withOpacity(0.4)),
                      ),
                      child: Text(s, style: GoogleFonts.inter(color: Colors.white, fontSize: 12)),
                    ),
                  )).toList(),
                ),
              ],
              const SizedBox(height: 10),
              TextField(
                controller: _wkExtra,
                style: GoogleFonts.inter(color: Colors.white),
                decoration: _fieldDec(_wkExtraLabel),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _wkLoading ? null : _searchWhoKnows,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0AB5CD),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(_wkLoading ? 'Searching…' : 'Search', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                ),
              ),
              if (_wkSearched) ...[
                const SizedBox(height: 14),
                if (_wkRows.isEmpty)
                  Text('No listeners found for $_wkTitle.', style: GoogleFonts.inter(color: Colors.white54))
                else
                  ..._wkRows.asMap().entries.map((e) {
                    final i = e.key;
                    final r = e.value;
                    final name = '${r['name'] ?? r['username'] ?? 'Unknown'}';
                    final plays = '${r['plays'] ?? r['playcount'] ?? r['count'] ?? '—'}';
                    final share = r['share'];
                    final avatar = r['avatar'] as String?;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.03),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withOpacity(0.06)),
                      ),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 30,
                            child: Text('#${i + 1}',
                                style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: i == 0 ? Colors.amber : Colors.white54)),
                          ),
                          if (avatar != null && avatar.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(right: 10),
                              child: CircleAvatar(backgroundImage: CachedNetworkImageProvider(avatar), radius: 16),
                            ),
                          Expanded(child: Text(name, style: GoogleFonts.inter(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('$plays plays', style: GoogleFonts.inter(color: const Color(0xFF0AB5CD), fontSize: 12, fontWeight: FontWeight.bold)),
                              if (share != null)
                                Text(share is num ? '$share%' : '$share', style: GoogleFonts.inter(color: Colors.white54, fontSize: 11)),
                            ],
                          ),
                        ],
                      ),
                    );
                  }),
              ],
            ],
          )),
          const SizedBox(height: 24),
          const SectionHeader(title: 'Pace'),
          const SizedBox(height: 10),
          _card(child: Column(
            children: [
              TextField(controller: _paceUser, style: GoogleFonts.inter(color: Colors.white), decoration: _fieldDec('Last.fm username')),
              const SizedBox(height: 10),
              TextField(
                controller: _paceGoal,
                keyboardType: TextInputType.number,
                style: GoogleFonts.inter(color: Colors.white),
                decoration: _fieldDec('Goal (optional)'),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _paceLoading ? null : _searchPace,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0AB5CD),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(_paceLoading ? 'Checking…' : 'Check pace', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                ),
              ),
              if (_pace != null) ...[
                const SizedBox(height: 14),
                _paceView(_pace!),
              ],
            ],
          )),
          const SizedBox(height: 24),
          const SectionHeader(title: 'Taste match'),
          const SizedBox(height: 10),
          _card(child: Column(
            children: [
              TextField(controller: _tasteA, style: GoogleFonts.inter(color: Colors.white), decoration: _fieldDec('Username A')),
              const SizedBox(height: 10),
              TextField(controller: _tasteB, style: GoogleFonts.inter(color: Colors.white), decoration: _fieldDec('Username B')),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _tasteLoading ? null : _searchTaste,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0AB5CD),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(_tasteLoading ? 'Comparing…' : 'Compare', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                ),
              ),
              if (_taste != null) ...[
                const SizedBox(height: 14),
                _tasteView(_taste!),
              ],
            ],
          )),
        ],
      ),
    );
  }

  InputDecoration _fieldDec(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: GoogleFonts.inter(color: Colors.white38),
        filled: true,
        fillColor: Colors.white.withOpacity(0.05),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
      );

  Widget _card({required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.07)),
      ),
      child: child,
    );
  }

  Widget _paceView(Map<String, dynamic> p) {
    final total = p['total'] ?? p['playcount'] ?? p['scrobbles'] ?? '—';
    final daily = p['dailyRate'] ?? p['daily_rate'] ?? p['perDay'] ?? '—';
    final nextM = p['nextMilestone'] ?? p['next_milestone'] ?? p['next']?['milestone'] ?? '—';
    String etaDate = '—';
    String etaDays = '';
    final next = p['next'];
    if (next is Map) {
      etaDate = '${next['date'] ?? next['eta'] ?? '—'}';
      final days = next['days'];
      if (days != null) etaDays = '$days days';
      if (next['reached'] == true) etaDate = 'Reached ✓';
    }
    final goalEta = p['goalEta'] ?? p['goal_eta'] ?? p['goal']?['eta'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _kv('Total', '$total', LucideIcons.barChart3),
        _kv('Daily rate', '$daily / day', LucideIcons.activity),
        _kv('Next milestone', '$nextM', LucideIcons.flag),
        _kv('ETA', etaDays.isEmpty ? etaDate : '$etaDate · $etaDays', LucideIcons.calendar),
        if (goalEta != null) _kv('Goal ETA', '$goalEta', LucideIcons.target),
        if (p['prevMilestone'] != null) _kv('Previous', '${p['prevMilestone']}', LucideIcons.check),
      ],
    );
  }

  Widget _tasteView(Map<String, dynamic> t) {
    final rawScore = t['score'] ?? t['similarity'] ?? t['percent'] ?? t['match'];
    String scoreStr = '—';
    if (rawScore is num) {
      final v = rawScore.toDouble();
      scoreStr = v <= 1 ? '${(v * 100).toStringAsFixed(1)}%' : '${v.toStringAsFixed(1)}%';
    } else if (rawScore != null) {
      scoreStr = '$rawScore';
    }
    final rawShared = t['sharedArtists'] ?? t['shared'] ?? t['common'] ?? t['artists'];
    List<String> shared = [];
    if (rawShared is List) {
      shared = rawShared.map((e) {
        if (e is String) return e;
        if (e is Map) return '${e['name'] ?? e['artist'] ?? e['title'] ?? ''}';
        return '$e';
      }).where((s) => s.isNotEmpty).toList();
    }
    final a = '${t['a'] ?? ''}';
    final b = '${t['b'] ?? ''}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(
          child: Column(
            children: [
              Text(scoreStr, style: GoogleFonts.outfit(fontSize: 40, fontWeight: FontWeight.w800, color: const Color(0xFF0AB5CD))),
              if (a.isNotEmpty || b.isNotEmpty)
                Text('$a × $b', style: GoogleFonts.inter(color: Colors.white54, fontSize: 12)),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Text('Shared artists (${shared.length})', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        if (shared.isEmpty)
          Text('No shared artists found.', style: GoogleFonts.inter(color: Colors.white54, fontSize: 13))
        else
          ...shared.take(10).map((s) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    const Icon(LucideIcons.music, size: 14, color: Color(0xFF0AB5CD)),
                    const SizedBox(width: 8),
                    Expanded(child: Text(s, style: GoogleFonts.inter(fontSize: 13))),
                  ],
                ),
              )),
      ],
    );
  }

  Widget _kv(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: const Color(0xFF0AB5CD)),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: GoogleFonts.inter(color: Colors.white54, fontSize: 13))),
          Flexible(child: Text(value, style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13), textAlign: TextAlign.right)),
        ],
      ),
    );
  }
}
