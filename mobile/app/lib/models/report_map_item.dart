import 'pet_report.dart';

class ReportMapItem {
  const ReportMapItem({
    required this.type,
    required this.latitude,
    required this.longitude,
    this.count,
    this.bounds,
    this.report,
  });

  final String type;
  final double latitude;
  final double longitude;
  final int? count;
  final MapBounds? bounds;
  final PetReport? report;

  bool get isCluster => type == 'cluster';
  bool get isReport => type == 'report';

  factory ReportMapItem.fromJson(Map<String, dynamic> json) {
    final coordinates = json['coordinates'];
    final latitude =
        _coordinateAt(coordinates, 0) ??
        _toDouble(json['lat'] ?? json['latitude']) ??
        0;
    final longitude =
        _coordinateAt(coordinates, 1) ??
        _toDouble(json['lng'] ?? json['longitude']) ??
        0;
    final type = (json['type'] ?? 'report').toString();

    return ReportMapItem(
      type: type,
      latitude: latitude,
      longitude: longitude,
      count: _toInt(json['count']),
      bounds: json['bounds'] is Map
          ? MapBounds.fromJson(Map<String, dynamic>.from(json['bounds'] as Map))
          : null,
      report: type == 'report'
          ? PetReport.fromJson({
              ...json,
              'latitude': latitude,
              'longitude': longitude,
            })
          : null,
    );
  }
}

class MapBounds {
  const MapBounds({
    required this.west,
    required this.south,
    required this.east,
    required this.north,
  });

  final double west;
  final double south;
  final double east;
  final double north;

  factory MapBounds.fromJson(Map<String, dynamic> json) {
    return MapBounds(
      west: _toDouble(json['west']) ?? 0,
      south: _toDouble(json['south']) ?? 0,
      east: _toDouble(json['east']) ?? 0,
      north: _toDouble(json['north']) ?? 0,
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

int? _toInt(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value.toString());
}
