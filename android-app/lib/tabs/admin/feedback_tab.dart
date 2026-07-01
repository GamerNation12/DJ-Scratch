import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';

class AdminFeedbackTab extends StatefulWidget {
  const AdminFeedbackTab({super.key});
  @override
  State<AdminFeedbackTab> createState() => _AdminFeedbackTabState();
}

class _AdminFeedbackTabState extends State<AdminFeedbackTab> {
  final storage = const FlutterSecureStorage();
  bool _isLoading = true;
  List<dynamic> suggestions = [];
  
  String? _editingId;
  String _editStatus = 'pending';
  final TextEditingController _feedbackController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchSuggestions();
  }

  Future<void> _fetchSuggestions() async {
    final token = await storage.read(key: 'token');
    if (token == null) return;
    try {
      final res = await http.get(
        Uri.parse('https://dj-scratch.vercel.app/api/suggestions'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200 && mounted) {
        setState(() {
          suggestions = jsonDecode(res.body);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveFeedback(String id) async {
    final token = await storage.read(key: 'token');
    await http.patch(
      Uri.parse('https://dj-scratch.vercel.app/api/suggestions/$id'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode({'status': _editStatus, 'admin_feedback': _feedbackController.text}),
    );
    setState(() => _editingId = null);
    _fetchSuggestions();
  }

  Color _getStatusColor(String status) {
    if (status == 'approved' || status == 'completed') return Colors.greenAccent;
    if (status == 'denied') return Colors.redAccent;
    return Colors.amberAccent;
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator(color: Colors.indigoAccent));

    return ListView(
      padding: const EdgeInsets.all(20),
      children: suggestions.map((s) {
        bool isEditing = _editingId == s['id'];
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF18181B).withOpacity(0.5),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(child: Text(s['title'] ?? '', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white))),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getStatusColor(s['status']).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: _getStatusColor(s['status']).withOpacity(0.3)),
                    ),
                    child: Text(
                      (s['status'] ?? 'pending').toUpperCase(),
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _getStatusColor(s['status'])),
                    ),
                  )
                ],
              ),
              const SizedBox(height: 4),
              Text('From ${s['username']}', style: const TextStyle(color: Colors.indigoAccent, fontSize: 12)),
              const SizedBox(height: 12),
              Text(s['description'] ?? '', style: const TextStyle(color: Colors.white70, fontSize: 14)),
              
              if (s['admin_feedback'] != null && !isEditing) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.indigoAccent.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Admin Reply', style: TextStyle(color: Colors.indigoAccent, fontSize: 10, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(s['admin_feedback'], style: const TextStyle(color: Colors.white, fontSize: 13)),
                    ],
                  ),
                )
              ],

              if (isEditing) ...[
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  value: _editStatus,
                  dropdownColor: const Color(0xFF18181B),
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    filled: true, fillColor: Colors.black26,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'pending', child: Text('Pending')),
                    DropdownMenuItem(value: 'approved', child: Text('Approved')),
                    DropdownMenuItem(value: 'denied', child: Text('Denied')),
                    DropdownMenuItem(value: 'completed', child: Text('Completed')),
                  ],
                  onChanged: (v) => setState(() => _editStatus = v!),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _feedbackController,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'Public Reply',
                    hintStyle: const TextStyle(color: Colors.white30),
                    filled: true,
                    fillColor: Colors.black26,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(onPressed: () => setState(() => _editingId = null), child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
                    ElevatedButton(
                      onPressed: () => _saveFeedback(s['id']),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.indigoAccent),
                      child: const Text('Save'),
                    )
                  ],
                )
              ] else ...[
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () {
                      setState(() {
                        _editingId = s['id'];
                        _editStatus = s['status'] ?? 'pending';
                        _feedbackController.text = s['admin_feedback'] ?? '';
                      });
                    },
                    child: const Text('Review', style: TextStyle(color: Colors.indigoAccent)),
                  ),
                )
              ]
            ],
          ),
        );
      }).toList(),
    );
  }
}
