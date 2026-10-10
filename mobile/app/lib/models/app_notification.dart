class AppNotification {
  const AppNotification({
    required this.id,
    required this.createdAt,
    required this.type,
    required this.title,
    required this.data,
    this.profileId,
    this.reportId,
    this.sightingId,
    this.readAt,
    this.body,
  });

  final String id;
  final String? profileId;
  final String? reportId;
  final String? sightingId;
  final String createdAt;
  final String? readAt;
  final String type;
  final String title;
  final String? body;
  final Map<String, dynamic> data;

  bool get isUnread => readAt == null || readAt!.isEmpty;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id']?.toString() ?? '',
      profileId: json['profileId']?.toString(),
      reportId: json['reportId']?.toString(),
      sightingId: json['sightingId']?.toString(),
      createdAt: json['createdAt']?.toString() ?? '',
      readAt: json['readAt']?.toString(),
      type: json['type']?.toString() ?? 'notification',
      title: json['title']?.toString() ?? 'Notificacion',
      body: json['body']?.toString(),
      data: _mapData(json['data']),
    );
  }

  AppNotification copyWith({String? readAt}) {
    return AppNotification(
      id: id,
      profileId: profileId,
      reportId: reportId,
      sightingId: sightingId,
      createdAt: createdAt,
      readAt: readAt ?? this.readAt,
      type: type,
      title: title,
      body: body,
      data: data,
    );
  }

  String? get targetReportId {
    return reportId ?? data['reportId']?.toString();
  }

  String? get zone {
    return data['zone']?.toString();
  }

  String? get statusLabel {
    final explicit = data['statusLabel']?.toString();
    if (explicit != null && explicit.isNotEmpty) {
      return explicit;
    }

    return data['status']?.toString() == 'pending'
        ? 'pendiente de revision'
        : null;
  }

  static Map<String, dynamic> _mapData(dynamic value) {
    if (value is Map<String, dynamic>) {
      return value;
    }
    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }
    return const <String, dynamic>{};
  }
}
