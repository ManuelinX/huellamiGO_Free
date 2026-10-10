part of 'api_client.dart';

extension ApiClientReports on ApiClient {
  Future<List<PetReport>> getReports({
    String status = 'active',
    List<double>? bbox,
  }) async {
    final query = <String, String>{'status': status};
    if (bbox != null) {
      query['bbox'] = bbox.join(',');
    }
    final body = await _get(_withQuery('/api/reports', query));
    final rows = (body['reports'] as List<dynamic>? ?? <dynamic>[]);
    return rows
        .map((item) => PetReport.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<PetReport> getReport(String id) async {
    final body = await _get('/api/reports/$id');
    return PetReport.fromJson(body['report'] as Map<String, dynamic>);
  }

  Future<List<PetReport>> getMyReports() async {
    final body = await _get('/api/reports/mine', auth: true);
    final rows = (body['reports'] as List<dynamic>? ?? <dynamic>[]);
    return rows
        .map((item) => PetReport.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<PetReport> createReport(Map<String, dynamic> report) async {
    final body = await _post('/api/reports', body: report, auth: true);
    return PetReport.fromJson(body['report'] as Map<String, dynamic>);
  }

  Future<List<ReportMapItem>> getReportMap({
    required List<double> bbox,
    required double zoom,
    String status = 'active',
  }) async {
    final body = await _get(
      _withQuery('/api/reports/map', {
        'bbox': bbox.join(','),
        'zoom': zoom.toString(),
        'status': status,
      }),
    );
    final rows = (body['items'] as List<dynamic>? ?? <dynamic>[]);
    return rows
        .map((item) => ReportMapItem.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  String _withQuery(String path, Map<String, String> query) {
    final pairs = query.entries
        .where((entry) => entry.value.isNotEmpty)
        .map(
          (entry) =>
              '${Uri.encodeQueryComponent(entry.key)}=${Uri.encodeQueryComponent(entry.value)}',
        )
        .join('&');
    return pairs.isEmpty ? path : '$path?$pairs';
  }
}
