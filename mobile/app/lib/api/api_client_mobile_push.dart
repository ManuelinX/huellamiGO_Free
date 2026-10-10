part of 'api_client.dart';

extension ApiClientMobilePush on ApiClient {
  Future<void> registerMobilePushToken({
    required String token,
    String platform = 'android',
  }) async {
    await _post(
      '/api/notifications/push/mobile-tokens',
      auth: true,
      body: {
        'token': token,
        'platform': platform,
      },
    );
  }

  Future<void> disableMobilePushToken(String token) async {
    await _send(
      'DELETE',
      '/api/notifications/push/mobile-tokens',
      auth: true,
      body: {'token': token},
    );
  }
}
