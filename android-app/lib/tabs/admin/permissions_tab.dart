import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';

class AdminPermissionsTab extends StatefulWidget {
  const AdminPermissionsTab({super.key});
  @override
  State<AdminPermissionsTab> createState() => _AdminPermissionsTabState();
}

class _AdminPermissionsTabState extends State<AdminPermissionsTab> {
  final storage = const FlutterSecureStorage();
  bool _isLoading = true;
  List<dynamic> permissions = [];
  final TextEditingController _idController = TextEditingController();
  String _selectedCommand = 'restart';

  @override
  void initState() {
    super.initState();
    _fetchPermissions();
  }

  Future<void> _fetchPermissions() async {
    final token = await storage.read(key: 'token');
    if (token == null) return;
    try {
      final res = await http.get(
        Uri.parse('https://dj-scratch.vercel.app/api/admin/permissions'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200 && mounted) {
        setState(() {
          permissions = jsonDecode(res.body);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _grantPermission() async {
    if (_idController.text.isEmpty) return;
    final token = await storage.read(key: 'token');
    await http.post(
      Uri.parse('https://dj-scratch.vercel.app/api/admin/permissions'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode({'userId': _idController.text, 'commandName': _selectedCommand}),
    );
    _idController.clear();
    _fetchPermissions();
  }

  Future<void> _revokePermission(String userId, String commandName) async {
    final token = await storage.read(key: 'token');
    await http.delete(
      Uri.parse('https://dj-scratch.vercel.app/api/admin/permissions'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode({'userId': userId, 'commandName': commandName}),
    );
    _fetchPermissions();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator(color: Colors.indigoAccent));

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF18181B).withOpacity(0.5),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Grant Permission", style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 12),
              TextField(
                controller: _idController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Discord User ID',
                  hintStyle: const TextStyle(color: Colors.white30),
                  filled: true,
                  fillColor: Colors.black26,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _selectedCommand,
                      dropdownColor: const Color(0xFF18181B),
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        filled: true, fillColor: Colors.black26,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'restart', child: Text('restart')),
                        DropdownMenuItem(value: 'sync', child: Text('sync')),
                        DropdownMenuItem(value: 'stats', child: Text('stats')),
                        DropdownMenuItem(value: 'wipedata', child: Text('wipedata')),
                        DropdownMenuItem(value: 'resetcd', child: Text('resetcd')),
                      ],
                      onChanged: (v) => setState(() => _selectedCommand = v!),
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: _grantPermission,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigoAccent,
                      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text("Grant", style: TextStyle(fontWeight: FontWeight.bold)),
                  )
                ],
              )
            ],
          ),
        ),
        const SizedBox(height: 24),
        Text("Active Permissions", style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 12),
        ...permissions.map((p) => ListTile(
          title: Text(p['user_id'], style: GoogleFonts.mono(color: Colors.white)),
          subtitle: Text('.${p['command_name']}', style: const TextStyle(color: Colors.indigoAccent, fontWeight: FontWeight.bold)),
          trailing: IconButton(icon: const Icon(Icons.delete, color: Colors.redAccent), onPressed: () => _revokePermission(p['user_id'], p['command_name'])),
        )),
      ],
    );
  }
}
