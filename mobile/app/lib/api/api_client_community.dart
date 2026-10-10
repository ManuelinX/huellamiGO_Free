part of 'api_client.dart';

extension ApiClientCommunity on ApiClient {
  Future<List<PetReport>> getReunionStories() async {
    final body = await _get('/api/reports/reunion-stories');
    final rows = (body['stories'] as List<dynamic>? ?? <dynamic>[]);
    return rows
        .map((item) => PetReport.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<int?> getPresenceStats() async {
    final body = await _get('/api/presence');
    final activeCount = body['activeCount'] ?? body['active_count'];
    if (activeCount is num) {
      return activeCount.toInt();
    }
    return int.tryParse(activeCount?.toString() ?? '');
  }
}
