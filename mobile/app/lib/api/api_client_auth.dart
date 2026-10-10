part of 'api_client.dart';

extension ApiClientAuth on ApiClient {
  Future<String?> getAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(ApiClient._tokenKey);
  }

  Future<void> clearAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(ApiClient._tokenKey);
  }

  Future<UserProfile> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    final body = await _post(
      '/api/auth/register',
      body: {'email': email, 'password': password, 'displayName': displayName},
    );
    await _storeAuthToken(body);
    return UserProfile.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<UserProfile> getMe() async {
    final body = await _get('/api/auth/me', auth: true);
    return UserProfile.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<UserProfile> login({
    required String email,
    required String password,
  }) async {
    final body = await _post(
      '/api/auth/login',
      body: {'email': email, 'password': password},
    );

    await _storeAuthToken(body);

    return UserProfile.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<void> requestPasswordReset({required String email}) async {
    await _post('/api/auth/password-reset/request', body: {'email': email});
  }

  Future<UserProfile> confirmPasswordReset({
    required String token,
    required String password,
  }) async {
    final body = await _post(
      '/api/auth/password-reset/confirm',
      body: {'token': token, 'password': password},
    );
    await _storeAuthToken(body);
    return UserProfile.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<void> changePassword({
    required String currentPassword,
    required String nextPassword,
  }) async {
    await _post(
      '/api/auth/password/change',
      auth: true,
      body: {'currentPassword': currentPassword, 'nextPassword': nextPassword},
    );
  }

  Future<void> requestEmailVerification() async {
    await _post('/api/auth/email-verification/request', auth: true);
  }

  Future<UserProfile> confirmEmailVerification({required String token}) async {
    final body = await _post(
      '/api/auth/email-verification/confirm',
      body: {'token': token},
    );
    await _storeAuthToken(body);
    return UserProfile.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<void> _storeAuthToken(Map<String, dynamic> body) async {
    final token = body['token']?.toString();
    if (token == null || token.isEmpty) {
      throw const ApiException('Respuesta sin token');
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(ApiClient._tokenKey, token);
  }
}
