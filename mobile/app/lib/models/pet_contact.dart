class PetContact {
  const PetContact({
    required this.name,
    required this.preferredMethod,
    required this.publicWhatsapp,
    required this.masked,
    this.whatsappUrl,
  });

  final String name;
  final String preferredMethod;
  final bool publicWhatsapp;
  final String masked;
  final String? whatsappUrl;

  factory PetContact.fromJson(Map<String, dynamic> json) {
    return PetContact(
      name: (json['name'] ?? json['contact_name'] ?? 'Familia').toString(),
      preferredMethod:
          (json['preferredMethod'] ??
                  json['preferred_method'] ??
                  json['preferred_contact'] ??
                  'Mensaje por HuellamiGO')
              .toString(),
      publicWhatsapp: _toBool(
        json['publicWhatsapp'] ?? json['public_whatsapp'],
      ),
      masked:
          (json['masked'] ??
                  (_toBool(json['publicWhatsapp'] ?? json['public_whatsapp'])
                      ? 'WhatsApp visible'
                      : 'Contacto protegido'))
              .toString(),
      whatsappUrl: _toNullableString(
        json['whatsappUrl'] ?? json['whatsapp_url'],
      ),
    );
  }
}

String? _toNullableString(dynamic value) {
  if (value == null) {
    return null;
  }
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
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
