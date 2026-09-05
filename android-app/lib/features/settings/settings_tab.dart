import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/auth_store.dart';
import '../../core/config.dart';
import '../auth/login_screen.dart';

class SettingsTab extends StatefulWidget {
  const SettingsTab({super.key});
  @override
  State<SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<SettingsTab> {
  String _version = '';

  @override
  void initState() {
    super.initState();
    PackageInfo.fromPlatform().then((p) {
      if (mounted) setState(() => _version = '${p.version}+${p.buildNumber}');
    });
  }

  Future<void> _logout() async {
    await AuthStore.clear();
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0, title: Text('Settings', style: GoogleFonts.outfit(fontWeight: FontWeight.w700))),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        Text('DJ Scratch v$_version', style: GoogleFonts.inter(color: Colors.white54)),
        const SizedBox(height: 16),
        ListTile(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          tileColor: Colors.white.withOpacity(0.04),
          title: Text('Open website', style: GoogleFonts.inter()),
          trailing: const Icon(Icons.open_in_new, color: Colors.white54),
          onTap: () => launchUrl(Uri.parse(AppConfig.apiBase), mode: LaunchMode.externalApplication),
        ),
        const SizedBox(height: 10),
        ListTile(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          tileColor: Colors.redAccent.withOpacity(0.1),
          title: Text('Log out', style: GoogleFonts.inter(color: Colors.redAccent, fontWeight: FontWeight.bold)),
          trailing: const Icon(Icons.logout, color: Colors.redAccent),
          onTap: _logout,
        ),
      ]),
    );
  }
}
