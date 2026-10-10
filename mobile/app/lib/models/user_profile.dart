class UserProfile {
  const UserProfile({
    required this.id,
    required this.emailVerified,
    required this.role,
    this.email,
    this.displayName,
    this.username,
    this.avatarUrl,
    this.bio,
    this.phone,
    this.city,
    this.state,
    this.country,
    this.emailVerifiedAt,
    this.isPublic,
  });

  final String id;
  final String? email;
  final String? displayName;
  final String? username;
  final String? avatarUrl;
  final String? bio;
  final String? phone;
  final String? city;
  final String? state;
  final String? country;
  final bool emailVerified;
  final String? emailVerifiedAt;
  final bool? isPublic;
  final String role;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: (json['id'] ?? '').toString(),
      email: _toNullableString(json['email']),
      displayName: _toNullableString(
        json['displayName'] ?? json['display_name'],
      ),
      username: _toNullableString(json['username']),
      avatarUrl: _toNullableString(json['avatarUrl'] ?? json['avatar_url']),
      bio: _toNullableString(json['bio']),
      phone: _toNullableString(json['phone']),
      city: _toNullableString(json['city']),
      state: _toNullableString(json['state']),
      country: _toNullableString(json['country']),
      emailVerified: _toBool(json['emailVerified'] ?? json['email_verified']),
      emailVerifiedAt: _toNullableString(
        json['emailVerifiedAt'] ?? json['email_verified_at'],
      ),
      isPublic: _toNullableBool(json['isPublic'] ?? json['is_public']),
      role: (json['role'] ?? 'authenticated').toString(),
    );
  }
}

bool? _toNullableBool(dynamic value) {
  if (value == null) {
    return null;
  }
  return _toBool(value);
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
