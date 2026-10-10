part of 'api_client.dart';

extension ApiClientSightings on ApiClient {
  Future<List<Sighting>> getSightings(
    String reportId, {
    bool includeHidden = false,
  }) async {
    final body = await _get(
      '/api/reports/$reportId/sightings?includeHidden=$includeHidden',
    );
    final rows = (body['sightings'] as List<dynamic>? ?? <dynamic>[]);
    return rows
        .map((item) => Sighting.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<Sighting> createSighting(
    String reportId,
    Map<String, dynamic> sighting,
  ) async {
    final body = await _post(
      '/api/reports/$reportId/sightings',
      body: sighting,
      auth: true,
    );
    return Sighting.fromJson(body['sighting'] as Map<String, dynamic>);
  }
}
