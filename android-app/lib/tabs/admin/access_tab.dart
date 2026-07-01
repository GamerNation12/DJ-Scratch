import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';

class AdminAccessTab extends StatefulWidget {
  const AdminAccessTab({super.key});
  @override
  State<AdminAccessTab> createState() => _AdminAccessTabState();
}

class _AdminAccessTabState extends State<AdminAccessTab> {
  final storage = const FlutterSecureStorage();
  bool _isLoading = true;
  List<String> admins = [];
  List<String> moderators = [];
  final TextEditingController _idController = TextEditingController();
  String _selectedRole = 'admin';

  @override
  void initState() {
    super.initState();
    _fetchAccess();
  }

  Future<void> _fetchAccess() async {
    final token = await storage.read(key: 'token');
    if (token == null) return;
    try {
      final res = await http.get(
        Uri.parse('https://dj-scratch.vercel.app/api/admin/access'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200 && mounted) {
        final data = jsonDecode(res.body);
        setState(() {
          admins = List<String>.from(data['admins'] ?? []);
          moderators = List<String>.from(data['moderators'] ?? []);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _addAccess() async {
    if (_idController.text.isEmpty) return;
    final token = await storage.read(key: 'token');
    await http.post(
      Uri.parse('https://dj-scratch.vercel.app/api/admin/access'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode({'id': _idController.text, 'role': _selectedRole}),
    );
    _idController.clear();
    _fetchAccess();
  }

  Future<void> _removeAccess(String id) async {
    final token = await storage.read(key: 'token');
    await http.delete(
      Uri.parse('https://dj-scratch.vercel.app/api/admin/access'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode({'id': id}),
    );
    _fetchAccess();
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
              Text("Add User", style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
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
                      value: _selectedRole,
                      dropdownColor: const Color(0xFF18181B),
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        filled: true, fillColor: Colors.black26,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'admin', child: Text('Full Admin')),
                        DropdownMenuItem(value: 'moderator', child: Text('Moderator')),
                      ],
                      onChanged: (v) => setState(() => _selectedRole = v!),
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: _addAccess,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigoAccent,
                      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text("Add", style: TextStyle(fontWeight: FontWeight.bold)),
                  )
                ],
              )
            ],
          ),
        ),
        const SizedBox(height: 24),
        Text("Admins", style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 12),
        ...admins.map((id) => ListTile(
          title: Text(id, style: GoogleFonts.robotoMono(color: Colors.white)),
          trailing: IconButton(icon: const Icon(Icons.delete, color: Colors.redAccent), onPressed: () => _removeAccess(id)),
        )),
        const SizedBox(height: 24),
        Text("Moderators", style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 12),
        ...moderators.map((id) => ListTile(
          title: Text(id, style: GoogleFonts.robotoMono(color: Colors.white)),
          trailing: IconButton(icon: const Icon(Icons.delete, color: Colors.redAccent), onPressed: () => _removeAccess(id)),
        )),
      ],
    );
  }
}
