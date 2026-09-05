import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthStore {
  static const _key = 'token';
  static const storage = FlutterSecureStorage();

  static Future<String?> readToken() => storage.read(key: _key);
  static Future<void> saveToken(String t) => storage.write(key: _key, value: t);
  static Future<void> clear() => storage.delete(key: _key);

  static Map<String, dynamic>? decode(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      return (jsonDecode(payload) as Map).cast<String, dynamic>();
    } catch (_) {
      return null;
    }
  }

  static String canonicalName(String name) => name == 'gamernation12' ? 'GamerNation12' : name;
}
