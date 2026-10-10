class UploadedPhoto {
  const UploadedPhoto({
    required this.publicUrl,
    this.storageBucket,
    this.storagePath,
    this.contentType,
    this.sizeBytes,
  });

  final String publicUrl;
  final String? storageBucket;
  final String? storagePath;
  final String? contentType;
  final int? sizeBytes;

  factory UploadedPhoto.fromJson(Map<String, dynamic> json) {
    return UploadedPhoto(
      publicUrl: (json['publicUrl'] ?? json['public_url'] ?? '').toString(),
      storageBucket: _toNullableString(
        json['storageBucket'] ?? json['storage_bucket'],
      ),
      storagePath: _toNullableString(
        json['storagePath'] ?? json['storage_path'],
      ),
      contentType: _toNullableString(
        json['contentType'] ?? json['content_type'],
      ),
      sizeBytes: _toInt(json['sizeBytes'] ?? json['size_bytes']),
    );
  }
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

String? _toNullableString(dynamic value) {
  if (value == null) {
    return null;
  }
  final text = value.toString();
  return text.isEmpty ? null : text;
}
