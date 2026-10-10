import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/pet_report.dart';
import '../models/app_notification.dart';
import '../models/notification_preferences.dart';
import '../models/managed_sighting_map_item.dart';
import '../models/report_map_item.dart';
import '../models/reviewed_search_zone.dart';
import '../models/sighting.dart';
import '../models/uploaded_photo.dart';
import '../models/user_profile.dart';

part 'api_client_auth.dart';
part 'api_client_community.dart';
part 'api_client_manage.dart';
part 'api_client_mobile_push.dart';
part 'api_client_notifications.dart';
part 'api_client_profile.dart';
part 'api_client_reports.dart';
part 'api_client_sightings.dart';
part 'api_client_uploads.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.payload});

  final String message;
  final int? statusCode;
  final Map<String, dynamic>? payload;

  @override
  String toString() => message;
}

class ApiClient {
  static const String _defaultBaseUrl = 'http://192.168.0.179:4000';
  static const String _tokenKey = 'huellamigo_auth_token';
  static const String _betaAccess = String.fromEnvironment(
    'HUELLAMIGO_BETA_ACCESS',
  );

  final http.Client _httpClient = http.Client();

  String get _baseUrl {
    const fromDefine = String.fromEnvironment('HUELLAMIGO_API_URL');
    if (fromDefine.isNotEmpty) {
      return fromDefine;
    }
    return _defaultBaseUrl;
  }

  Future<Map<String, dynamic>> _get(
    String path, {
    bool auth = false,
    Map<String, String>? headers,
  }) {
    return _send('GET', path, auth: auth, headers: headers);
  }

  Future<Map<String, dynamic>> _post(
    String path, {
    Map<String, dynamic>? body,
    bool auth = false,
    Map<String, String>? headers,
  }) {
    return _send('POST', path, body: body, auth: auth, headers: headers);
  }

  Future<Map<String, dynamic>> _patch(
    String path, {
    Map<String, dynamic>? body,
    bool auth = false,
    Map<String, String>? headers,
  }) {
    return _send('PATCH', path, body: body, auth: auth, headers: headers);
  }

  Future<Map<String, dynamic>> _delete(
    String path, {
    Map<String, dynamic>? body,
    bool auth = false,
    Map<String, String>? headers,
  }) {
    return _send('DELETE', path, body: body, auth: auth, headers: headers);
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool auth = false,
    Map<String, String>? headers,
  }) async {
    final requestHeaders = await _headers(
      auth: auth,
      hasJsonBody: body != null,
      extraHeaders: headers,
    );
    final uri = Uri.parse('$_baseUrl$path');

    final response = switch (method) {
      'GET' => await _httpClient.get(uri, headers: requestHeaders),
      'POST' => await _httpClient.post(
        uri,
        headers: requestHeaders,
        body: jsonEncode(body),
      ),
      'PATCH' => await _httpClient.patch(
        uri,
        headers: requestHeaders,
        body: jsonEncode(body),
      ),
      'DELETE' => await _httpClient.delete(
        uri,
        headers: requestHeaders,
        body: body == null ? null : jsonEncode(body),
      ),
      _ => throw ApiException('Metodo HTTP no soportado: $method'),
    };

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

  Future<Map<String, String>> _headers({
    required bool auth,
    required bool hasJsonBody,
    Map<String, String>? extraHeaders,
  }) async {
    final headers = <String, String>{'Accept': 'application/json'};

    if (_betaAccess.isNotEmpty) {
      headers['x-beta-access'] = _betaAccess;
    }

    if (hasJsonBody) {
      headers['Content-Type'] = 'application/json';
    }

    if (auth) {
      final token = await getAuthToken();
      if (token == null || token.isEmpty) {
        throw const ApiException('Necesitas iniciar sesion.');
      }
      headers['Authorization'] = 'Bearer $token';
    }

    if (extraHeaders != null) {
      headers.addAll(extraHeaders);
    }

    return headers;
  }

  Map<String, dynamic> _decodeJsonObject(http.Response response) {
    final dynamic decoded;

    try {
      decoded = jsonDecode(response.body);
    } on FormatException {
      throw ApiException(
        'Respuesta invalida del servidor.',
        statusCode: response.statusCode,
      );
    }

    if (decoded is Map<String, dynamic>) {
      return decoded;
    }

    if (decoded is Map) {
      return Map<String, dynamic>.from(decoded);
    }

    throw ApiException(
      'Respuesta inesperada del servidor.',
      statusCode: response.statusCode,
    );
  }
}
