import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'config.dart';

/// One-tap in-app updater: checks the release pubspec for a newer build,
/// downloads the APK with progress, then hands it to the system installer
/// (no browser / manual APK hunting).
class UpdateService {
  static const _channel = MethodChannel('djscratch/update');

  /// Remote build number from the version.json pinned to the published APK
  /// (source of truth). Returns null when unknown — the caller treats that
  /// as "no update" rather than prompting on guesses.
  ///
  /// NOTE: this deliberately does NOT compare against main's pubspec: the
  /// pubspec moves on every push (auto-bump), including pushes whose APK
  /// never published, which caused endless "update available" loops.
  static Future<int?> remoteBuildNumber() async {
    try {
      final res = await http.get(Uri.parse(
          'https://github.com/GamerNation12/DJ-Scratch/releases/latest/download/version.json'));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final b = int.tryParse('${data['build']}');
        if (b != null) return b;
      }
    } catch (_) {}
    return null;
  }

  static Future<bool> isUpdateAvailable() async {
    final remote = await remoteBuildNumber();
    if (remote == null) return false;
    final info = await PackageInfo.fromPlatform();
    final local = int.tryParse(info.buildNumber) ?? 0;
    return remote > local;
  }

  /// Downloads the release APK into the app cache, reporting 0.0–1.0 progress.
  static Future<File> downloadApk({void Function(double progress)? onProgress}) async {
    final client = http.Client();
    try {
      final req = http.Request('GET', Uri.parse(AppConfig.apkUrl));
      final res = await client.send(req);
      if (res.statusCode != 200) {
        throw Exception('Download failed (${res.statusCode})');
      }
      final total = res.contentLength ?? 0;
      final dir = await getTemporaryDirectory();
      final updates = Directory('${dir.path}/updates');
      if (!await updates.exists()) await updates.create(recursive: true);
      final file = File('${updates.path}/DJ-Scratch.apk');
      final sink = file.openWrite();
      var received = 0;
      await for (final chunk in res.stream) {
        received += chunk.length;
        sink.add(chunk);
        if (total > 0) onProgress?.call(received / total);
      }
      await sink.close();
      onProgress?.call(1.0);
      return file;
    } finally {
      client.close();
    }
  }

  /// Opens the Android package installer for [apk]. Returns true if launched.
  static Future<bool> installApk(File apk) async {
    try {
      final ok = await _channel.invokeMethod<bool>('installApk', {'path': apk.path});
      return ok == true;
    } on MissingPluginException {
      // Non-Android / dev builds: channel unavailable.
      return false;
    } catch (_) {
      return false;
    }
  }
}
