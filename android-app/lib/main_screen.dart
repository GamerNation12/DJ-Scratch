import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:http/http.dart' as http;
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
