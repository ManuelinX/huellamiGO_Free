class Sighting {
  const Sighting({
    required this.id,
    required this.reportId,
    required this.comment,
    required this.latitude,
    required this.longitude,
    required this.status,
    required this.isUseful,
    required this.isTrailKey,
    required this.trustScore,
    this.seenAt,
    this.photoUrl,
    this.contactName,
    this.createdAt,
  });

  final String id;
  final String reportId;
  final String comment;
  final double? latitude;
  final double? longitude;
  final String status;
  final bool isUseful;
  final bool isTrailKey;
  final int trustScore;
  final String? seenAt;
  final String? photoUrl;
  final String? contactName;
  final String? createdAt;

  factory Sighting.fromJson(Map<String, dynamic> json) {
    final coordinates = json['coordinates'];

    return Sighting(
      id: (json['id'] ?? '').toString(),
      reportId: (json['reportId'] ?? json['report_id'] ?? '').toString(),
      comment: (json['comment'] ?? '').toString(),
      latitude:
          _coordinateAt(coordinates, 0) ??
          _toDouble(json['lat'] ?? json['latitude']),
      longitude:
          _coordinateAt(coordinates, 1) ??
          _toDouble(json['lng'] ?? json['longitude']),
      status: (json['status'] ?? 'visible').toString(),
      isUseful: _toBool(json['isUseful'] ?? json['is_useful']),
      isTrailKey: _toBool(json['isTrailKey'] ?? json['is_trail_key']),
      trustScore: _toInt(json['trustScore'] ?? json['trust_score']),
      seenAt: _toNullableString(json['seenAt'] ?? json['seen_at']),
      photoUrl: _toNullableString(json['photoUrl'] ?? json['photo_url']),
      contactName: _toNullableString(
        json['contactName'] ?? json['contact_name'],
      ),
      createdAt: _toNullableString(json['createdAt'] ?? json['created_at']),
    );
  }

  bool get isHidden => status == 'hidden';

  String get confidenceLabel {
    if (trustScore >= 75) {
      return 'Alta';
    }
    if (trustScore >= 50) {
      return 'Media';
    }
    return 'Baja';
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

int _toInt(dynamic value) {
  if (value == null) {
    return 0;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value.toString()) ?? 0;
}

bool _toBool(dynamic value) {
  if (value is bool) {
    return value;
  }
  if (value is num) {
    return value != 0;
  }
  return value?.toString().toLowerCase() == 'true';
}

String? _toNullableString(dynamic value) {
  if (value == null) {
    return null;
  }
  final text = value.toString();
  return text.isEmpty ? null : text;
}
