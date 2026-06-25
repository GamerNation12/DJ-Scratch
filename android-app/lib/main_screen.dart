import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:google_fonts/google_fonts.dart';
import 'tabs/dashboard_tab.dart';
import 'tabs/leaderboard_tab.dart';
import 'tabs/admin_tab.dart';
import 'tabs/settings_tab.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  final storage = const FlutterSecureStorage();
  int _currentIndex = 0;
  String? _adminRole;
  bool _isLoading = true;

  final List<Widget> _baseTabs = [
    const DashboardTab(),
    const LeaderboardTab(),
    const SettingsTab(),
  ];

  @override
  void initState() {
    super.initState();
    _checkAdminStatus();
    _checkForUpdates();
  }

  Future<void> _checkForUpdates() async {
    try {
      final res = await http.get(Uri.parse('https://raw.githubusercontent.com/GamerNation12/The-Goats-Dj/main/android-app/pubspec.yaml'));
      if (res.statusCode == 200) {
        final match = RegExp(r'version: \d+\.\d+\.\d+\+(\d+)').firstMatch(res.body);
        if (match != null) {
          final githubBuildNumber = int.parse(match.group(1)!);
          
          final packageInfo = await PackageInfo.fromPlatform();
          final localBuildNumber = int.parse(packageInfo.buildNumber);

          if (githubBuildNumber > localBuildNumber && mounted) {
            _showUpdateDialog();
          }
        }
      }
    } catch (e) {
      // Ignore update check errors
    }
  }

  void _showUpdateDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: const Color(0xFF0AB5CD).withOpacity(0.5))),
        title: Row(
          children: [
            const Icon(LucideIcons.downloadCloud, color: Color(0xFF0AB5CD)),
            const SizedBox(width: 12),
            Text('Update Available', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(
          'A new version of The Goats DJ is available! Please update to get the latest features and bug fixes.',
          style: GoogleFonts.inter(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Later', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0AB5CD),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              final url = Uri.parse('https://the-goats-dj.vercel.app/The-Goats-DJ.apk');
              if (await canLaunchUrl(url)) {
                await launchUrl(url, mode: LaunchMode.externalApplication);
              }
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('Update Now'),
          ),
        ],
      ),
    );
  }

  Future<void> _checkAdminStatus() async {
    try {
      final token = await storage.read(key: 'token');
      if (token != null) {
        final res = await http.get(
          Uri.parse('https://the-goats-dj.vercel.app/api/admin/check'),
          headers: {'Authorization': 'Bearer $token'},
        );
        if (res.statusCode == 200) {
          final data = jsonDecode(res.body);
          if (mounted) setState(() => _adminRole = data['role']);
        }
      }
    } catch (e) {
      // Ignore admin check errors
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF030712),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF0AB5CD))),
      );
    }

    final hasAdmin = _adminRole != null;
    
    // Dynamically insert Admin tab if they have permission
    final tabs = [
      const DashboardTab(),
      const LeaderboardTab(),
      if (hasAdmin) const AdminTab(),
      const SettingsTab(),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: IndexedStack(
        index: _currentIndex,
        children: tabs,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05))),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
          backgroundColor: const Color(0xFF030712),
          indicatorColor: const Color(0xFF0AB5CD).withOpacity(0.2),
          destinations: [
            const NavigationDestination(
              icon: Icon(LucideIcons.layoutDashboard, color: Colors.white54),
              selectedIcon: Icon(LucideIcons.layoutDashboard, color: Color(0xFF0AB5CD)),
              label: 'Dashboard',
            ),
            const NavigationDestination(
              icon: Icon(LucideIcons.trophy, color: Colors.white54),
              selectedIcon: Icon(LucideIcons.trophy, color: Color(0xFF0AB5CD)),
              label: 'Leaderboard',
            ),
            if (hasAdmin)
              const NavigationDestination(
                icon: Icon(LucideIcons.shieldAlert, color: Colors.white54),
                selectedIcon: Icon(LucideIcons.shieldAlert, color: Colors.redAccent),
                label: 'Admin',
              ),
            const NavigationDestination(
              icon: Icon(LucideIcons.settings, color: Colors.white54),
              selectedIcon: Icon(LucideIcons.settings, color: Color(0xFF0AB5CD)),
              label: 'Settings',
            ),
          ],
        ),
      ),
    );
  }
}
