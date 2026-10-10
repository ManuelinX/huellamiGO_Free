import 'dart:async';

import 'package:flutter/services.dart';

class DeepLinkService {
  static const _methodChannel = MethodChannel('huellamigo/deep_links');
  static const _eventChannel = EventChannel('huellamigo/deep_links/events');

  Stream<String> get links {
    return _eventChannel
        .receiveBroadcastStream()
        .where((event) => event is String)
        .map((event) => event as String);
  }

  Future<String?> getInitialLink() async {
    try {
      final link = await _methodChannel.invokeMethod<String>('getInitialLink');
      return link;
    } on MissingPluginException {
      return null;
    }
  }
}

String? getPasswordResetTokenFromLink(String link) {
  final uri = Uri.tryParse(link);

  if (uri == null) {
    return null;
  }

  final host = uri.host.toLowerCase();
  final isHuellamiGoHost = host == 'huellamigo.com';

  if (!isHuellamiGoHost) {
    return null;
  }

  final resetToken = uri.queryParameters['resetToken'];
  if (resetToken != null && resetToken.isNotEmpty) {
    return resetToken;
  }

  final token = uri.queryParameters['token'];
  if (uri.path == '/reset-password' && token != null && token.isNotEmpty) {
    return token;
  }

  return null;
}
