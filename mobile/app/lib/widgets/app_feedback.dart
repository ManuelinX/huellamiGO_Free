import 'package:flutter/material.dart';

import 'huellamigo_ui.dart';

String friendlyErrorTitle(Object? error, {String fallback = 'Algo salio mal'}) {
  final text = error.toString().toLowerCase();

  if (_looksLikeNetworkError(text)) {
    return 'Sin conexion';
  }

  if (text.contains('timeout') || text.contains('timed out')) {
    return 'Conexion lenta';
  }

  return fallback;
}

String friendlyErrorMessage(
  Object? error, {
  String fallback = 'Intenta de nuevo en un momento.',
}) {
  final text = error.toString().toLowerCase();

  if (_looksLikeNetworkError(text)) {
    return 'Revisa tu internet e intenta otra vez.';
  }

  if (text.contains('timeout') || text.contains('timed out')) {
    return 'La conexion tardo demasiado. Intenta de nuevo.';
  }

  if (text.contains('401') || text.contains('unauthorized')) {
    return 'Tu sesion expiro. Inicia sesion otra vez.';
  }

  if (text.contains('403') || text.contains('forbidden')) {
    return 'No tienes permiso para hacer esta accion.';
  }

  if (text.contains('404') || text.contains('not found')) {
    return 'No encontramos esa informacion.';
  }

  return fallback;
}

bool _looksLikeNetworkError(String text) {
  return text.contains('socketexception') ||
      text.contains('failed host lookup') ||
      text.contains('connection abort') ||
      text.contains('network is unreachable') ||
      text.contains('no address associated with hostname') ||
      text.contains('connection refused') ||
      text.contains('connection reset') ||
      text.contains('clientexception with socketexception');
}

class AppLoadingState extends StatelessWidget {
  const AppLoadingState({
    super.key,
    this.padding = 48,
    this.title = 'Cargando',
    this.message = 'Estamos preparando la informacion.',
    this.center = false,
  });

  final double padding;
  final String title;
  final String message;
  final bool center;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: padding),
      child: AppMessageState(
        icon: Icons.pets,
        title: title,
        message: message,
        center: center,
        accentColor: HuellamiGOColors.forest,
        indicator: const SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

class AppMessageState extends StatelessWidget {
  const AppMessageState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
    this.center = false,
    this.accentColor = HuellamiGOColors.forest,
    this.indicator,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;
  final bool center;
  final Color accentColor;
  final Widget? indicator;

  @override
  Widget build(BuildContext context) {
    final content = Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: HuellamiGOColors.paper,
        border: Border.all(color: HuellamiGOColors.line),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: HuellamiGOColors.forest.withValues(alpha: 0.06),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: accentColor,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: indicator ?? Icon(icon, size: 28, color: Colors.white),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: HuellamiGOFonts.title,
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(message, textAlign: TextAlign.center),
          if (action != null) ...[const SizedBox(height: 14), action!],
        ],
      ),
    );

    if (!center) {
      return content;
    }

    return Center(
      child: Padding(padding: const EdgeInsets.all(24), child: content),
    );
  }
}

class AppInlineMessage extends StatelessWidget {
  const AppInlineMessage({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: HuellamiGOColors.mint,
        border: Border.all(color: HuellamiGOColors.line),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(message),
    );
  }
}
