import 'package:flutter/material.dart';

EdgeInsets scrollScreenPadding(BuildContext context) {
  return EdgeInsets.fromLTRB(
    16,
    12,
    16,
    MediaQuery.of(context).padding.bottom + 32,
  );
}
