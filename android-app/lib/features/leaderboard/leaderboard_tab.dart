import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/api_client.dart';
import '../../core/auth_store.dart';
import '../../widgets/states.dart';

class LeaderboardTab extends StatefulWidget {
  const LeaderboardTab({super.key});
  @override
  State<LeaderboardTab> createState() => _LeaderboardTabState();
}

class _LeaderboardTabState extends State<LeaderboardTab> {
  bool _loading = true;
  String _error = '';
  String _query = '';
  List<Map> _rows = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = ''; });
    try {
      final token = await AuthStore.readToken();
      final data = await ApiClient(token).getJson('/api/leaderboard');
      final list = ((data['leaderboard'] as List?) ?? []).cast<Map>();
      if (!mounted) return;
      setState(() { _rows = list; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: Color(0xFF030712), body: LoadingView());
    if (_error.isNotEmpty) return Scaffold(backgroundColor: const Color(0xFF030712), body: ErrorView(message: _error, onRetry: _load));
    final rows = _rows.where((r) => _query.isEmpty || '${r['username']}'.toLowerCase().contains(_query.toLowerCase())).toList();
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0,
          title: Text('Leaderboard', style: GoogleFonts.outfit(fontWeight: FontWeight.w700))),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(20), children: [
          TextField(
            onChanged: (v) => setState(() => _query = v),
            style: GoogleFonts.inter(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Search users…', hintStyle: GoogleFonts.inter(color: Colors.white38),
              prefixIcon: const Icon(LucideIcons.search, color: Colors.white38, size: 18),
              filled: true, fillColor: Colors.white.withOpacity(0.05),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 16),
          if (rows.isEmpty) const EmptyView(title: 'No entries')
          else ...rows.asMap().entries.map((e) {
            final i = e.key;
            final u = e.value;
            final plays = u['total_scrobbles'] ?? u['playcount'] ?? 0;
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.04), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withOpacity(0.06))),
              child: Row(children: [
                SizedBox(width: 30, child: Text('#${i + 1}', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: i == 0 ? Colors.amber : Colors.white54))),
                if (u['avatar'] != null) CircleAvatar(backgroundImage: CachedNetworkImageProvider('${u['avatar']}'), radius: 18),
                const SizedBox(width: 12),
                Expanded(child: Text('${u['username'] ?? 'Unknown'}', style: GoogleFonts.inter(fontWeight: FontWeight.w600))),
                Text('$plays', style: GoogleFonts.outfit(color: const Color(0xFF0AB5CD), fontWeight: FontWeight.bold)),
              ]),
            );
          }),
        ]),
      ),
    );
  }
}
