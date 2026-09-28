import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/api_client.dart';
import '../../core/auth_store.dart';
import '../../widgets/update_flow.dart';
import '../dashboard/dashboard_tab.dart';
import '../player/player_tab.dart';
import '../leaderboard/leaderboard_tab.dart';
import '../friends/friends_tab.dart';
import '../messages/messages_tab.dart';
import '../admin/admin_tab.dart';
import '../settings/settings_tab.dart';
import '../tools/tools_tab.dart';
import '../support/support_tab.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});
  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _index = 0;
  String _more = 'friends';
  String? _role;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    // Await the admin check BEFORE building the nav so destinations never
    // shift underneath the selected index.
    final role = await _fetchRole();
    if (!mounted) return;
    setState(() {
      _role = role;
      _ready = true;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkUpdate());
  }

  Future<String?> _fetchRole() async {
    try {
      final token = await AuthStore.readToken();
      if (token == null || token.isEmpty) return null;
      final data = await ApiClient(token).getJson('/api/admin/check');
      return data['role']?.toString();
    } catch (_) {
      return null;
    }
  }

  Future<void> _checkUpdate() async {
    if (!mounted) return;
    // Silent launch check — only prompts when an update is actually available.
    await runUpdateFlow(context, silentWhenCurrent: true);
  }

  bool get _isAdmin => _role == 'admin' || _role == 'owner';

  Widget _currentMorePage() {
    switch (_more) {
      case 'tools':
        return const ToolsTab();
      case 'support':
        return const SupportTab();
      case 'settings':
        return const SettingsTab();
      case 'admin':
        return _isAdmin ? const AdminTab() : const FriendsTab();
      case 'friends':
      default:
        return const FriendsTab();
    }
  }

  String _moreLabel() {
    switch (_more) {
      case 'tools':
        return 'Tools';
      case 'support':
        return 'Support';
      case 'settings':
        return 'Settings';
      case 'admin':
        return 'Admin';
      case 'friends':
      default:
        return 'More';
    }
  }

  Future<void> _openMoreSheet() async {
    final admin = _isAdmin;
    await showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text('More', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white)),
              ),
              _moreTile(ctx, 'friends', 'Friends', LucideIcons.users),
              _moreTile(ctx, 'tools', 'Tools', LucideIcons.wrench),
              _moreTile(ctx, 'support', 'Support', LucideIcons.lifeBuoy),
              _moreTile(ctx, 'settings', 'Settings', LucideIcons.settings),
              if (admin) _moreTile(ctx, 'admin', 'Admin', LucideIcons.shield),
            ],
          ),
        ),
      ),
    );
  }

  Widget _moreTile(BuildContext ctx, String key, String label, IconData icon) {
    final selected = _index == 4 && _more == key;
    return ListTile(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      tileColor: selected ? const Color(0xFF0AB5CD).withOpacity(0.15) : null,
      leading: Icon(icon, color: selected ? const Color(0xFF0AB5CD) : Colors.white70),
      title: Text(label, style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
      trailing: selected ? const Icon(LucideIcons.check, color: Color(0xFF0AB5CD), size: 18) : null,
      onTap: () {
        Navigator.pop(ctx);
        setState(() {
          _more = key;
          _index = 4;
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const Scaffold(backgroundColor: Color(0xFF030712), body: Center(child: CircularProgressIndicator(color: Color(0xFF0AB5CD))));
    }
    final Widget body;
    if (_index == 4) {
      body = _currentMorePage();
    } else {
      const primaries = [
        DashboardTab(),
        PlayerTab(),
        LeaderboardTab(),
        MessagesTab(),
      ];
      body = primaries[_index.clamp(0, 3).toInt()];
    }
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index.clamp(0, 4).toInt(),
        onDestinationSelected: (i) {
          if (i == 4) {
            _openMoreSheet();
            // Still highlight "More" so the bar reflects where the user is
            // headed; the sheet picks the actual sub-page.
            setState(() => _index = 4);
          } else {
            setState(() => _index = i);
          }
        },
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
        backgroundColor: const Color(0xFF030712),
        indicatorColor: const Color(0xFF0AB5CD).withOpacity(0.2),
        destinations: [
          const NavigationDestination(icon: Icon(LucideIcons.layoutDashboard, color: Colors.white54), selectedIcon: Icon(LucideIcons.layoutDashboard, color: Color(0xFF0AB5CD)), label: 'Home'),
          const NavigationDestination(icon: Icon(LucideIcons.music, color: Colors.white54), selectedIcon: Icon(LucideIcons.music, color: Color(0xFF22C55E)), label: 'Player'),
          const NavigationDestination(icon: Icon(LucideIcons.trophy, color: Colors.white54), selectedIcon: Icon(LucideIcons.trophy, color: Color(0xFF0AB5CD)), label: 'Ranks'),
          const NavigationDestination(icon: Icon(LucideIcons.messageSquare, color: Colors.white54), selectedIcon: Icon(LucideIcons.messageSquare, color: Color(0xFF0AB5CD)), label: 'Chat'),
          NavigationDestination(
            icon: const Icon(LucideIcons.menu, color: Colors.white54),
            selectedIcon: const Icon(LucideIcons.menu, color: Color(0xFF0AB5CD)),
            label: _moreLabel(),
          ),
        ],
      ),
    );
  }
}
