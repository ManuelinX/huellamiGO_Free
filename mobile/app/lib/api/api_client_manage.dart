part of 'api_client.dart';

extension ApiClientManage on ApiClient {
  Map<String, String> _manageHeaders(String token) {
    return {'X-Manage-Token': token};
  }

  Future<PetReport> getManagedReport(String id, String token) async {
    final body = await _get('/api/manage/$id', headers: _manageHeaders(token));
    return PetReport.fromJson(body['report'] as Map<String, dynamic>);
  }

  Future<List<Sighting>> getManagedSightings(String id, String token) async {
    final body = await _get(
      '/api/manage/$id/sightings',
      headers: _manageHeaders(token),
    );
    final rows = (body['sightings'] as List<dynamic>? ?? <dynamic>[]);
    return rows
        .map((item) => Sighting.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<ManagedSightingMapItem>> getManagedSightingMap(
    String id,
    String token, {
    required List<double> bbox,
    required double zoom,
  }) async {
    final encodedBbox = Uri.encodeQueryComponent(bbox.join(','));
    final body = await _get(
      '/api/manage/$id/sightings/map?bbox=$encodedBbox&zoom=$zoom',
      headers: _manageHeaders(token),
    );
    final rows = (body['items'] as List<dynamic>? ?? <dynamic>[]);
    return rows
        .map(
          (item) =>
              ManagedSightingMapItem.fromJson(item as Map<String, dynamic>),
        )
        .toList();
  }

  Future<List<ReviewedSearchZone>> getReviewedSearchZones(
    String id,
    String token,
  ) async {
    final body = await _get(
      '/api/manage/$id/reviewed-zones',
      headers: _manageHeaders(token),
    );
    final rows = (body['zones'] as List<dynamic>? ?? <dynamic>[]);
    return rows
        .map(
          (item) => ReviewedSearchZone.fromJson(item as Map<String, dynamic>),
        )
        .toList();
  }

  Future<ReviewedSearchZone> createReviewedSearchZone({
    required String reportId,
    required String token,
    required double latitude,
    required double longitude,
    required String note,
    required DateTime checkedAt,
  }) async {
    final body = await _post(
      '/api/manage/$reportId/reviewed-zones',
      headers: _manageHeaders(token),
      body: {
        'lat': latitude,
        'lng': longitude,
        'note': note,
        'checkedAt': checkedAt.toUtc().toIso8601String(),
      },
    );
    return ReviewedSearchZone.fromJson(body['zone'] as Map<String, dynamic>);
  }

  Future<void> deleteReviewedSearchZone({
    required String reportId,
    required String token,
    required String zoneId,
  }) async {
    await _delete(
      '/api/manage/$reportId/reviewed-zones/$zoneId',
      headers: _manageHeaders(token),
    );
  }

  Future<PetReport> updateManagedReportStatus({
    required String id,
    required String token,
    required String status,
    Map<String, dynamic> reunionStory = const <String, dynamic>{},
  }) async {
    final body = await _patch(
      '/api/manage/$id/status',
      headers: _manageHeaders(token),
      body: {'status': status, 'reunionStory': reunionStory},
    );
    return PetReport.fromJson(body['report'] as Map<String, dynamic>);
  }

  Future<Sighting> updateManagedSighting({
    required String reportId,
    required String token,
    required String sightingId,
    required String status,
    required bool isUseful,
    bool isTrailKey = false,
  }) async {
    final body = await _patch(
      '/api/manage/$reportId/sightings/$sightingId',
      headers: _manageHeaders(token),
      body: {'status': status, 'isUseful': isUseful, 'isTrailKey': isTrailKey},
    );
    return Sighting.fromJson(body['sighting'] as Map<String, dynamic>);
  }
}
