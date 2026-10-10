class ReviewedSearchZone {
  const ReviewedSearchZone({
    required this.id,
    required this.reportId,
    required this.latitude,
    required this.longitude,
    required this.radiusM,
    required this.note,
    required this.checkedAt,
    required this.createdAt,
  });

  final String id;
  final String reportId;
  final double latitude;
  final double longitude;
  final double radiusM;
  final String note;
  final String checkedAt;
  final String createdAt;

  factory ReviewedSearchZone.fromJson(Map<String, dynamic> json) {
    final coordinates = json['coordinates'];

    return ReviewedSearchZone(
      id: (json['id'] ?? '').toString(),
      reportId: (json['reportId'] ?? json['report_id'] ?? '').toString(),
      latitude:
          _coordinateAt(coordinates, 0) ??
          _toDouble(json['lat'] ?? json['latitude']) ??
          0,
      longitude:
          _coordinateAt(coordinates, 1) ??
          _toDouble(json['lng'] ?? json['longitude']) ??
          0,
      radiusM: _toDouble(json['radiusM'] ?? json['radius_m']) ?? 500,
      note: (json['note'] ?? '').toString(),
      checkedAt: (json['checkedAt'] ?? json['checked_at'] ?? '').toString(),
      createdAt: (json['createdAt'] ?? json['created_at'] ?? '').toString(),
    );
  }
}

double? _coordinateAt(dynamic value, int index) {
  if (value is List && value.length > index) {
    return _toDouble(value[index]);
  }
  return null;
}

double? _toDouble(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value.toString());
}
