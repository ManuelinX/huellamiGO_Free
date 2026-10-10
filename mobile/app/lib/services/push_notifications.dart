import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

class PushNotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  StreamSubscription<String>? _tokenRefreshSubscription;
  StreamSubscription<RemoteMessage>? _foregroundSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;

  Future<void> configure({
    required ApiClient api,
    required VoidCallback onForegroundMessage,
    required ValueChanged<RemoteMessage> onMessageOpened,
  }) async {
    _foregroundSubscription ??= FirebaseMessaging.onMessage.listen((message) {
      onForegroundMessage();
    });
    _openedSubscription ??= FirebaseMessaging.onMessageOpenedApp.listen(
      onMessageOpened,
    );

    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      onMessageOpened(initialMessage);
    }

    _tokenRefreshSubscription ??= _messaging.onTokenRefresh.listen((token) {
      _registerToken(api, token);
    });
  }

  Future<void> registerSignedInDevice(ApiClient api) async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return;
    }

    final token = await _messaging.getToken();
    if (token == null || token.isEmpty) {
      return;
    }

    await _registerToken(api, token);
  }

  Future<void> unregisterCurrentDevice(ApiClient api) async {
    final token = await _messaging.getToken();
    if (token == null || token.isEmpty) {
      return;
    }

    await api.disableMobilePushToken(token);
  }

  Future<void> _registerToken(ApiClient api, String token) async {
    try {
      await api.registerMobilePushToken(token: token);
    } catch (_) {
      // Token registration is retried on next login/session refresh/token change.
    }
  }

  Future<void> dispose() async {
    await _tokenRefreshSubscription?.cancel();
    await _foregroundSubscription?.cancel();
    await _openedSubscription?.cancel();
  }
}
