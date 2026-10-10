class Reward {
  const Reward({
    required this.enabled,
    required this.showAmount,
    required this.amount,
    required this.currency,
  });

  final bool enabled;
  final bool showAmount;
  final double? amount;
  final String currency;

  factory Reward.fromJson(Map<String, dynamic> json) {
    return Reward(
      enabled: _toBool(json['enabled'] ?? json['reward_enabled']),
      showAmount: _toBool(
        json['showAmount'] ?? json['show_amount'] ?? json['reward_show_amount'],
      ),
      amount: _toDouble(json['amount'] ?? json['reward_amount']),
      currency: (json['currency'] ?? json['reward_currency'] ?? 'MXN')
          .toString(),
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

double? _toDouble(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value.toString());
}
