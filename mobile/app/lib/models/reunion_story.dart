class ReunionStory {
  const ReunionStory({
    required this.publicAllowed,
    this.photoUrl,
    this.photoUrl2,
    this.message,
  });

  final String? photoUrl;
  final String? photoUrl2;
  final String? message;
  final bool publicAllowed;

  factory ReunionStory.fromJson(Map<String, dynamic> json) {
    return ReunionStory(
      photoUrl: _toNullableString(json['photoUrl'] ?? json['photo_url']),
      photoUrl2: _toNullableString(json['photoUrl2'] ?? json['photo_url_2']),
      message: _toNullableString(json['message']),
      publicAllowed: _toBool(json['publicAllowed'] ?? json['public_allowed']),
    );
  }
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
