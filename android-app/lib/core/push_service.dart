import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;

import 'auth_store.dart';
import 'config.dart';

/// Push notifications via FCM. Fully inert until the app is built with
/// google-services.json — every entry point fails silent without it.
@pragma('vm:entry-point')
Future<void> pushBackgroundHandler(RemoteMessage message) async {
  // Background/terminated: the system tray shows notification payloads.
}

class PushService {
  PushService._();
  static final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  static bool _ready = false;
  static GlobalKey<NavigatorState>? navigatorKey;

  static Future<void> init({GlobalKey<NavigatorState>? navKey}) async {
    if (_ready) return;
    if (navKey != null) navigatorKey = navKey;
    try {
      await Firebase.initializeApp();
    } catch (_) {
      return; // No google-services.json — push stays off.
    }
    try {
      FirebaseMessaging.onBackgroundMessage(pushBackgroundHandler);
      await FirebaseMessaging.instance.requestPermission();
      const channel = AndroidNotificationChannel(
        'default',
        'General',
        importance: Importance.high,
      );
      await _local
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
      await _local.initialize(
        const InitializationSettings(
            android: AndroidInitializationSettings('@mipmap/ic_launcher')),
        onDidReceiveNotificationResponse: (_) => _openHome(),
      );
      FirebaseMessaging.onMessage.listen(_showForeground);
      FirebaseMessaging.onMessageOpenedApp.listen((_) => _openHome());
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) _openHome();
      FirebaseMessaging.instance.onTokenRefresh.listen((_) => register());
      _ready = true;
      await register();
    } catch (_) {
      // Push is best-effort; the app works without it.
    }
  }

  static Future<void> _showForeground(RemoteMessage message) async {
    try {
      final n = message.notification;
      if (n == null) return;
      await _local.show(
        n.hashCode,
        n.title,
        n.body,
        const NotificationDetails(
          android: AndroidNotificationDetails('default', 'General',
              importance: Importance.high, priority: Priority.high),
        ),
      );
    } catch (_) {}
  }

  static void _openHome() {
    try {
      navigatorKey?.currentState
          ?.pushNamedAndRemoveUntil('/', (_) => false);
    } catch (_) {}
  }

  /// Send our FCM token to the backend (needs a signed-in user).
  static Future<void> register() async {
    try {
      final jwt = await AuthStore.readToken();
      if (jwt == null || jwt.isEmpty) return;
      final fcm = await FirebaseMessaging.instance.getToken();
      if (fcm == null || fcm.isEmpty) return;
      await http.post(
        Uri.parse('${AppConfig.apiBase}/api/push/register'),
        headers: {
          'Authorization': 'Bearer $jwt',
          'Content-Type': 'application/json'
        },
        body: jsonEncode({'fcmToken': fcm, 'platform': 'android'}),
      );
    } catch (_) {}
  }

  /// Stop pushes for this device (call on logout).
  static Future<void> unregister() async {
    try {
      final jwt = await AuthStore.readToken();
      final fcm = await FirebaseMessaging.instance.getToken();
      if (jwt == null || fcm == null) return;
      await http.delete(
        Uri.parse('${AppConfig.apiBase}/api/push/register'),
        headers: {
          'Authorization': 'Bearer $jwt',
          'Content-Type': 'application/json'
        },
        body: jsonEncode({'fcmToken': fcm}),
      ).timeout(const Duration(seconds: 8));
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }
}
