class NotificationPreferences {
  const NotificationPreferences({
    required this.notifySightingUpdates,
    required this.notifyNearbyReports,
    required this.radiusKm,
    required this.locationSource,
    this.alertLat,
    this.alertLng,
    this.alertPlaceLabel,
    this.exists = false,
  });

  final bool notifySightingUpdates;
  final bool notifyNearbyReports;
  final double radiusKm;
  final double? alertLat;
  final double? alertLng;
  final String? alertPlaceLabel;
  final String locationSource;
  final bool exists;

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) {
    return NotificationPreferences(
      notifySightingUpdates: json['notifySightingUpdates'] == true,
      notifyNearbyReports: json['notifyNearbyReports'] == true,
      radiusKm: _toDouble(json['radiusKm']) ?? 3,
      alertLat: _toDouble(json['alertLat']),
      alertLng: _toDouble(json['alertLng']),
      alertPlaceLabel: json['alertPlaceLabel']?.toString(),
      locationSource: json['locationSource']?.toString() ?? 'manual',
      exists: json['exists'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'notifySightingUpdates': notifySightingUpdates,
      'notifyNearbyReports': notifyNearbyReports,
      'alertLat': alertLat,
      'alertLng': alertLng,
      'alertPlaceLabel': alertPlaceLabel,
      'locationSource': locationSource,
    };
  }

  NotificationPreferences copyWith({
    bool? notifySightingUpdates,
    bool? notifyNearbyReports,
    double? radiusKm,
    double? alertLat,
    double? alertLng,
    String? alertPlaceLabel,
    String? locationSource,
    bool clearAlertLocation = false,
    bool? exists,
  }) {
    return NotificationPreferences(
      notifySightingUpdates:
          notifySightingUpdates ?? this.notifySightingUpdates,
      notifyNearbyReports: notifyNearbyReports ?? this.notifyNearbyReports,
      radiusKm: radiusKm ?? this.radiusKm,
      alertLat: clearAlertLocation ? null : alertLat ?? this.alertLat,
      alertLng: clearAlertLocation ? null : alertLng ?? this.alertLng,
      alertPlaceLabel: clearAlertLocation
          ? null
          : alertPlaceLabel ?? this.alertPlaceLabel,
      locationSource: locationSource ?? this.locationSource,
      exists: exists ?? this.exists,
    );
  }

  static double? _toDouble(dynamic value) {
    if (value is num) {
      return value.toDouble();
    }
    if (value is String) {
      return double.tryParse(value);
    }
    return null;
  }
}
