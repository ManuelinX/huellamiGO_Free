import 'report_map_item.dart';
import 'sighting.dart';

class ManagedSightingMapItem {
  const ManagedSightingMapItem({
    required this.type,
    required this.latitude,
    required this.longitude,
    this.count,
    this.usefulCount,
    this.trailKeyCount,
    this.pendingCount,
    this.hiddenCount,
    this.bounds,
    this.sighting,
  });

  final String type;
  final double latitude;
  final double longitude;
  final int? count;
  final int? usefulCount;
  final int? trailKeyCount;
  final int? pendingCount;
  final int? hiddenCount;
  final MapBounds? bounds;
  final Sighting? sighting;

  bool get isCluster => type == 'cluster';
  bool get isSighting => type == 'sighting';

  factory ManagedSightingMapItem.fromJson(Map<String, dynamic> json) {
    final coordinates = json['coordinates'];
    final latitude =
        _coordinateAt(coordinates, 0) ??
        _toDouble(json['lat'] ?? json['latitude']) ??
        0;
    final longitude =
        _coordinateAt(coordinates, 1) ??
        _toDouble(json['lng'] ?? json['longitude']) ??
        0;
    final type = (json['type'] ?? 'sighting').toString();

    return ManagedSightingMapItem(
      type: type,
      latitude: latitude,
      longitude: longitude,
      count: _toInt(json['count']),
      usefulCount: _toInt(json['usefulCount'] ?? json['useful_count']),
      trailKeyCount: _toInt(json['trailKeyCount'] ?? json['trail_key_count']),
      pendingCount: _toInt(json['pendingCount'] ?? json['pending_count']),
      hiddenCount: _toInt(json['hiddenCount'] ?? json['hidden_count']),
      bounds: json['bounds'] is Map
          ? MapBounds.fromJson(Map<String, dynamic>.from(json['bounds'] as Map))
          : null,
      sighting: type == 'sighting'
          ? Sighting.fromJson({
              ...json,
              'latitude': latitude,
              'longitude': longitude,
            })
          : null,
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
