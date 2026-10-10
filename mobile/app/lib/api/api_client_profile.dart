part of 'api_client.dart';

extension ApiClientProfile on ApiClient {
  Future<UserProfile> getProfile() async {
    final body = await _get('/api/profile', auth: true);
    return UserProfile.fromJson(body['profile'] as Map<String, dynamic>);
  }

  Future<UserProfile> updateProfile(Map<String, dynamic> profile) async {
    final body = await _patch('/api/profile', body: profile, auth: true);
    return UserProfile.fromJson(body['profile'] as Map<String, dynamic>);
  }

  Future<UserProfile> uploadProfileAvatar({
    required Uint8List bytes,
    required String filename,
    String contentType = 'image/webp',
  }) async {
    final body = await _multipartPost(
      '/api/profile/avatar',
      fieldName: 'avatar',
      bytes: bytes,
      filename: filename,
      contentType: contentType,
      auth: true,
    );
    return UserProfile.fromJson(body['profile'] as Map<String, dynamic>);
  }
}
