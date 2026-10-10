part of 'api_client.dart';

extension ApiClientUploads on ApiClient {
  Future<UploadedPhoto> uploadPetPhoto({
    required Uint8List bytes,
    required String filename,
    String contentType = 'image/webp',
  }) async {
    final body = await _multipartPost(
      '/api/uploads/pet-photo',
      fieldName: 'photo',
      bytes: bytes,
      filename: filename,
      contentType: contentType,
      auth: true,
    );
    return UploadedPhoto.fromJson(body['photo'] as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> _multipartPost(
    String path, {
    required String fieldName,
    required Uint8List bytes,
    required String filename,
    required String contentType,
    bool auth = false,
  }) async {
    final uri = Uri.parse('$_baseUrl$path');
    final request = http.MultipartRequest('POST', uri);
    final baseHeaders = await _headers(auth: auth, hasJsonBody: false);

    request.headers.addAll(baseHeaders);
    request.files.add(
      http.MultipartFile.fromBytes(
        fieldName,
        bytes,
        filename: filename,
        contentType: _mediaType(contentType),
      ),
    );

    final streamedResponse = await _httpClient.send(request);
    final response = await http.Response.fromStream(streamedResponse);
    final payload = _decodeJsonObject(response);

    if (response.statusCode >= 400) {
      if (response.statusCode == 401) {
        await clearAuthToken();
      }
      throw ApiException(
        (payload['error'] ?? 'Error HTTP ${response.statusCode}').toString(),
        statusCode: response.statusCode,
        payload: payload,
      );
    }

    return payload;
  }

  MediaType _mediaType(String contentType) {
    final parts = contentType.split('/');
    if (parts.length != 2 || parts.any((part) => part.isEmpty)) {
      return MediaType('application', 'octet-stream');
    }
    return MediaType(parts[0], parts[1]);
  }
}
