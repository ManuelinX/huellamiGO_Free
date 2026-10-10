class ReportStatus {
  const ReportStatus._();

  static const active = 'active';
  static const archived = 'archived';
  static const hidden = 'hidden';
  static const reunited = 'reunited';
  static const resolved = 'resolved';

  static const _inactiveStatuses = {
    archived,
    hidden,
    resolved,
    reunited,
    'reunida',
    'cerrado',
    'closed',
  };

  static String normalize(String status) {
    return status.trim().toLowerCase();
  }

  static bool isActive(String status) {
    return !_inactiveStatuses.contains(normalize(status));
  }

  static bool isReunited(String status) {
    final normalized = normalize(status);
    return normalized == reunited ||
        normalized == 'reunida' ||
        normalized == resolved;
  }

  static bool isHidden(String status) {
    return normalize(status) == hidden;
  }
}
