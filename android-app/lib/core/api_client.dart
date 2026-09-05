import 'dart:convert';
import 'package:http/http.dart' as http;
import 'config.dart';

class ApiException implements Exception {
  final String message;
  final int status;
  ApiException(this.message, this.status);
  @override
  String toString() => message;
}

class ApiClient {
  final String? token;
  ApiClient(this.token);

  Map<String, String> get _headers => {
        if (token != null && token!.isNotEmpty) 'Authorization': 'Bearer $token',
      };

  Future<Map<String, dynamic>> getJson(String path) async {
    final res = await http.get(Uri.parse('${AppConfig.apiBase}$path'), headers: _headers);
    final data = jsonDecode(res.body.isEmpty ? '{}' : res.body);
    if (res.statusCode >= 400) {
      final msg = (data is Map && data['error'] is String) ? data['error'] as String : 'Request failed (${res.statusCode})';
      throw ApiException(msg, res.statusCode);
    }
    return (data as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('${AppConfig.apiBase}$path'),
      headers: {..._headers, 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    final data = jsonDecode(res.body.isEmpty ? '{}' : res.body);
    if (res.statusCode >= 400) {
      final msg = (data is Map && data['error'] is String) ? data['error'] as String : 'Request failed (${res.statusCode})';
      throw ApiException(msg, res.statusCode);
    }
    return (data as Map).cast<String, dynamic>();
  }
}
