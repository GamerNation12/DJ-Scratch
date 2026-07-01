import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'admin/overview_tab.dart';
import 'admin/access_tab.dart';
import 'admin/permissions_tab.dart';
import 'admin/feedback_tab.dart';
import 'admin/users_tab.dart';
import 'admin/system_tab.dart';

class AdminTab extends StatefulWidget {
  const AdminTab({super.key});

  @override
  State<AdminTab> createState() => _AdminTabState();
}

class _AdminTabState extends State<AdminTab> with SingleTickerProviderStateMixin {
  final storage = const FlutterSecureStorage();
  bool _isLoading = true;
  String _role = '';
  TabController? _tabController;

  @override
  void initState() {
    super.initState();
    _checkRole();
  }

  Future<void> _checkRole() async {
    try {
      final token = await storage.read(key: 'token');
      if (token == null) return;
      
      final res = await http.get(
        Uri.parse('https://dj-scratch.vercel.app/api/admin/check'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (mounted) {
          setState(() {
            _role = data['role'] ?? '';
            _isLoading = false;
            int tabCount = _role == 'owner' ? 6 : (_role == 'admin' ? 4 : 1);
            _tabController = TabController(length: tabCount, vsync: this);
          });
        }
      } else {
        if (mounted) setState(() { _isLoading = false; });
      }
    } catch (e) {
      if (mounted) setState(() { _isLoading = false; });
    }
  }

  @override
  void dispose() {
    _tabController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF030712),
        body: Center(child: CircularProgressIndicator(color: Colors.indigoAccent)),
      );
    }

    if (_role.isEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFF030712),
        body: Center(
          child: Text('Unauthorized', style: GoogleFonts.outfit(color: Colors.redAccent, fontSize: 24)),
        ),
      );
    }

    List<Widget> tabs = [const Tab(text: 'Overview')];
    List<Widget> tabViews = [const AdminOverviewTab()];

    if (_role == 'owner') {
      tabs.add(const Tab(text: 'Access'));
      tabViews.add(const AdminAccessTab());
      tabs.add(const Tab(text: 'Permissions'));
      tabViews.add(const AdminPermissionsTab());
    }
    if (_role == 'owner' || _role == 'admin') {
      tabs.add(const Tab(text: 'Users'));
      tabViews.add(const AdminUsersTab());
    }
    
    tabs.add(const Tab(text: 'Feedback'));
    tabViews.add(const AdminFeedbackTab());

    if (_role == 'owner' || _role == 'admin') {
      tabs.add(const Tab(text: 'System'));
      tabViews.add(const AdminSystemTab());
    }

    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Row(
          children: [
            Text(
              'Admin Console',
              style: GoogleFonts.outfit(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.indigoAccent.withOpacity(0.2),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: Colors.indigoAccent.withOpacity(0.3)),
              ),
              child: Text(
                _role.toUpperCase(),
                style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.indigoAccent),
              ),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: Colors.indigoAccent,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white54,
          labelStyle: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: tabs,
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: tabViews,
      ),
    );
  }
}
