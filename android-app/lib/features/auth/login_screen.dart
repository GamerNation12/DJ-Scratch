import 'package:flutter/material.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/auth_store.dart';
import '../core/config.dart';
import '../features/shell/main_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _busy = false;

  Future<void> _login() async {
    setState(() => _busy = true);
    try {
      final redirect = Uri.encodeComponent('${AppConfig.apiBase}${AppConfig.authCallbackPath}');
      final url =
          'https://discord.com/oauth2/authorize?client_id=${AppConfig.discordClientId}&redirect_uri=$redirect&response_type=code&scope=${Uri.encodeComponent('identify guilds email')}&state=mobile';
      final result = await FlutterWebAuth2.authenticate(url: url, callbackUrlScheme: 'djscratch');
      final token = Uri.parse(result).queryParameters['token'];
      if (token != null && token.isNotEmpty) {
        await AuthStore.saveToken(token);
        if (mounted) {
          Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const MainScreen()));
        }
      } else {
        throw Exception('No token returned');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Login cancelled or failed.', style: GoogleFonts.inter()), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              ClipOval(
                child: Image.asset('assets/icon.png', width: 110, height: 110, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Icon(LucideIcons.music, size: 56, color: Colors.white)),
              ),
              const SizedBox(height: 24),
              Text('DJ Scratch', style: GoogleFonts.outfit(fontSize: 36, fontWeight: FontWeight.w800, color: Colors.white)),
              const SizedBox(height: 4),
              Text('v1.0.0 · music stats & control', style: GoogleFonts.inter(color: Colors.white54)),
              const SizedBox(height: 12),
              Text('Live scrobbles, leaderboard, friends, messages and Spotify controls.',
                  style: GoogleFonts.inter(color: Colors.white60), textAlign: TextAlign.center),
              const SizedBox(height: 36),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _busy ? null : _login,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF5865F2),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: _busy
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text('Continue with Discord', style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 16)),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
