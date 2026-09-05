import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const bg = Color(0xFF030712);
  static const card = Color(0xFF0F172A);
  static const accent = Color(0xFF0AB5CD);
  static const green = Color(0xFF22C55E);

  static ThemeData dark() {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bg,
      primaryColor: accent,
      useMaterial3: true,
      textTheme: GoogleFonts.interTextTheme().apply(bodyColor: Colors.white, displayColor: Colors.white),
    );
  }
}
