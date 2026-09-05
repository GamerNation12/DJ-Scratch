import 'package:flutter/material.dart';
import 'core/auth_store.dart';
import 'core/theme.dart';
import 'features/auth/login_screen.dart';
import 'features/shell/main_screen.dart';

void main() {
  runApp(const DjScratchApp());
}

class DjScratchApp extends StatelessWidget {
  const DjScratchApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DJ Scratch',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark(),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});
  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  @override
  void initState() {
    super.initState();
    _go();
  }

  Future<void> _go() async {
    final token = await AuthStore.readToken();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => (token != null && token.isNotEmpty) ? const MainScreen() : const LoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Color(0xFF030712),
      body: Center(child: CircularProgressIndicator(color: Color(0xFF0AB5CD))),
    );
  }
}
