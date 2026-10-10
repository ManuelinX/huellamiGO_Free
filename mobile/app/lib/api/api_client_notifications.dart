part of 'api_client.dart';

extension ApiClientNotifications on ApiClient {
  Future<List<AppNotification>> getNotifications({int limit = 30}) async {
    final body = await _get('/api/notifications?limit=$limit', auth: true);
    final rows = body['notifications'] as List<dynamic>? ?? <dynamic>[];
    return rows
        .map((item) => AppNotification.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<int> getUnreadNotificationsCount() async {
    final body = await _get('/api/notifications/unread-count', auth: true);
    return body['unreadCount'] as int? ?? 0;
  }

  Future<AppNotification> markNotificationAsRead(String id) async {
    final body = await _patch('/api/notifications/$id/read', auth: true);
    return AppNotification.fromJson(
      body['notification'] as Map<String, dynamic>,
    );
  }

  Future<int> markAllNotificationsAsRead() async {
    final body = await _patch('/api/notifications/read-all', auth: true);
    return body['updatedCount'] as int? ?? 0;
  }

  Future<NotificationPreferences> getNotificationPreferences() async {
    final body = await _get('/api/notifications/preferences', auth: true);
    return NotificationPreferences.fromJson(
      body['preferences'] as Map<String, dynamic>,
    );
  }

  Future<NotificationPreferences> updateNotificationPreferences(
    NotificationPreferences preferences,
  ) async {
    final body = await _patch(
      '/api/notifications/preferences',
      body: preferences.toJson(),
      auth: true,
    );
    return NotificationPreferences.fromJson(
      body['preferences'] as Map<String, dynamic>,
    );
  }
}
