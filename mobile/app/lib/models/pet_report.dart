import 'pet_contact.dart';
import 'reunion_story.dart';
import 'reward.dart';

class PetReport {
  const PetReport({
    required this.id,
    required this.slug,
    required this.name,
    required this.species,
    required this.zone,
    required this.lastSeenWhen,
    required this.description,
    required this.shortDescription,
    required this.photoUrl,
    required this.status,
    required this.reward,
    required this.latitude,
    required this.longitude,
    required this.sightingsCount,
    required this.reunionStory,
    required this.contact,
    required this.isVulnerable,
    required this.isUrgent,
    required this.needsMedication,
    required this.lifeStage,
    this.createdAt,
    this.manageExpiresAt,
    this.manageToken,
  });

  final String id;
  final String slug;
  final String name;
  final String species;
  final String zone;
  final String lastSeenWhen;
  final String description;
  final String shortDescription;
  final String? photoUrl;
  final String status;
  final Reward reward;
  final double? latitude;
  final double? longitude;
  final int sightingsCount;
  final ReunionStory reunionStory;
  final PetContact contact;
  final bool isVulnerable;
  final bool isUrgent;
  final bool needsMedication;
  final String lifeStage;
  final String? createdAt;
  final String? manageExpiresAt;
  final String? manageToken;

  String get petName => name;
  String get petType => species;

  factory PetReport.fromJson(Map<String, dynamic> json) {
    final coordinates = json['coordinates'];
    final rawLatitude = json['last_seen_lat'] ?? json['latitude'];
    final rawLongitude = json['last_seen_lng'] ?? json['longitude'];
    final latitude = rawLatitude == null
        ? null
        : _toDouble(rawLatitude) ?? _coordinateAt(coordinates, 0);
    final longitude = rawLongitude == null
        ? null
        : _toDouble(rawLongitude) ?? _coordinateAt(coordinates, 1);
    final fallbackName = (json['pet_name'] ?? json['petName'] ?? 'Sin nombre')
        .toString();
    final prioritySignals = _asMap(json['prioritySignals']);

    return PetReport(
      id: (json['id'] ?? '').toString(),
      slug: (json['slug'] ?? json['id'] ?? '').toString(),
      name: (json['name'] ?? fallbackName).toString(),
      species:
          (json['species'] ?? json['pet_type'] ?? json['petType'] ?? 'Mascota')
              .toString(),
      zone: (json['zone'] ?? 'Zona sin definir').toString(),
      lastSeenWhen:
          (json['lastSeenWhen'] ?? json['last_seen_when'] ?? 'Reciente')
              .toString(),
      description: (json['description'] ?? 'Sin descripcion.').toString(),
      shortDescription:
          (json['shortDescription'] ??
                  json['short_description'] ??
                  json['description'] ??
                  'Sin descripcion.')
              .toString(),
      photoUrl: _toNullableString(json['photoUrl'] ?? json['photo_url']),
      status: (json['status'] ?? 'active').toString(),
      reward: Reward.fromJson(_asMap(json['reward'], fallback: json)),
      latitude: latitude,
      longitude: longitude,
      sightingsCount: _toInt(json['sightingsCount'] ?? json['sightings_count']),
      reunionStory: ReunionStory.fromJson(
        _asMap(json['reunionStory'] ?? json['reunion_story']),
      ),
      contact: PetContact.fromJson(_asMap(json['contact'], fallback: json)),
      isVulnerable: _toBool(
        json['is_vulnerable'] ?? prioritySignals['isVulnerable'],
      ),
      isUrgent: _toBool(json['is_urgent'] ?? prioritySignals['isUrgent']),
      needsMedication: _toBool(
        json['needs_medication'] ?? prioritySignals['needsMedication'],
      ),
      lifeStage:
          (json['pet_life_stage'] ?? prioritySignals['lifeStage'] ?? 'adult')
              .toString(),
      createdAt: _toNullableString(json['createdAt'] ?? json['created_at']),
      manageExpiresAt: _toNullableString(
        json['manageExpiresAt'] ?? json['manage_expires_at'],
      ),
      manageToken: _toNullableString(
        json['manageToken'] ?? json['manage_token'],
      ),
    );
  }
}

Map<String, dynamic> _asMap(dynamic value, {Map<String, dynamic>? fallback}) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return fallback ?? <String, dynamic>{};
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
