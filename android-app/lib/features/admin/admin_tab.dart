import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api_client.dart';
import '../../core/auth_store.dart';
import '../../core/config.dart';
import '../../widgets/states.dart';

class AdminTab extends StatefulWidget {
  const AdminTab({super.key});
  @override
  State<AdminTab> createState() => _AdminTabState();
}

class _AdminTabState extends State<AdminTab> {
  bool _loading = true;
  String? _role;
  Map<String, dynamic>? _stats;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final token = await AuthStore.readToken();
      final api = ApiClient(token);
      final check = await api.getJson('/api/admin/check');
      if (!mounted) return;
      setState(() => _role = '${check['role'] ?? ''}');
      if (_role == 'admin' || _role == 'owner') {
        final s = await api.getJson('/api/admin/stats');
        if (!mounted) return;
        setState(() { _stats = s; _loading = false; });
      } else {
        setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: Color(0xFF030712), body: LoadingView(label: 'Checking access…'));
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0, title: Text('Admin', style: GoogleFonts.outfit(fontWeight: FontWeight.w700))),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        Text('Role: ${_role ?? 'none'}', style: GoogleFonts.inter(color: Colors.white70)),
        const SizedBox(height: 16),
        if (_stats != null) ...[
          _tile('Total scrobbles', '${_stats!['totalPlays'] ?? '—'}'),
          _tile('Users', '${_stats!['totalUsers'] ?? '—'}'),
        ] else
          const EmptyView(title: 'No admin access'),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: () => launchUrl(Uri.parse('${AppConfig.apiBase}/admin'), mode: LaunchMode.externalApplication),
          child: const Text('Open full web console'),
        ),
      ]),
    );
  }

  Widget _tile(String label, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.04), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withOpacity(0.07))),
      child: Row(children: [
        Expanded(child: Text(label, style: GoogleFonts.inter(color: Colors.white70))),
        Text(value, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18)),
      ]),
    );
  }
}
