import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

class LoadingView extends StatelessWidget {
  final String label;
  const LoadingView({super.key, this.label = 'Loading…'});
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const CircularProgressIndicator(color: Color(0xFF0AB5CD)),
        const SizedBox(height: 12),
        Text(label, style: GoogleFonts.inter(color: Colors.white54)),
      ]),
    );
  }
}

class ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const ErrorView({super.key, required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(LucideIcons.alertCircle, color: Colors.redAccent, size: 44),
          const SizedBox(height: 12),
          Text(message, style: GoogleFonts.inter(color: Colors.white), textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
        ]),
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  final String title;
  final String? hint;
  const EmptyView({super.key, required this.title, this.hint});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(children: [
        Text(title, style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold)),
        if (hint != null) ...[
          const SizedBox(height: 6),
          Text(hint!, style: GoogleFonts.inter(color: Colors.white54, fontSize: 13), textAlign: TextAlign.center),
        ],
      ]),
    );
  }
}

class SectionHeader extends StatelessWidget {
  final String title;
  final Widget? trailing;
  const SectionHeader({super.key, required this.title, this.trailing});
  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(child: Text(title, style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white))),
      if (trailing != null) trailing!,
    ]);
  }
}
