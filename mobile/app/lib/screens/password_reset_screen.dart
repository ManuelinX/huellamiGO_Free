import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../models/user_profile.dart';
import '../widgets/app_feedback.dart';
import '../widgets/app_fields.dart';
import '../widgets/screen_padding.dart';

class PasswordResetScreen extends StatefulWidget {
  const PasswordResetScreen({
    super.key,
    required this.api,
    required this.token,
    required this.onCompleted,
  });

  final ApiClient api;
  final String token;
  final ValueChanged<UserProfile> onCompleted;

  @override
  State<PasswordResetScreen> createState() => _PasswordResetScreenState();
}

class _PasswordResetScreenState extends State<PasswordResetScreen> {
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _loading = false;
  String? _message;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (password.isEmpty || confirmPassword.isEmpty) {
      setState(() => _message = 'Completa la nueva contrasena.');
      return;
    }

    if (password.length < 6) {
      setState(
        () => _message = 'La contrasena debe tener al menos 6 caracteres.',
      );
      return;
    }

    if (password != confirmPassword) {
      setState(() => _message = 'Las contrasenas no coinciden.');
      return;
    }

    setState(() {
      _loading = true;
      _message = null;
    });

    try {
      final user = await widget.api.confirmPasswordReset(
        token: widget.token,
        password: password,
      );
      widget.onCompleted(user);
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (error) {
      if (mounted) {
        setState(() => _message = 'Error: $error');
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nueva contrasena')),
      body: SafeArea(
        child: ListView(
          padding: scrollScreenPadding(context),
          children: [
            const Text(
              'Restablecer acceso',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            const Text('Escribe una nueva contrasena para tu cuenta.'),
            const SizedBox(height: 18),
            AppTextField(
              controller: _passwordController,
              label: 'Nueva contrasena',
              icon: Icons.lock_outline,
              obscureText: true,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            AppTextField(
              controller: _confirmPasswordController,
              label: 'Confirmar contrasena',
              icon: Icons.lock_reset,
              obscureText: true,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _loading ? null : _submit(),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _loading ? null : _submit,
              icon: _loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check_circle_outline),
              label: const Text('Cambiar contrasena'),
            ),
            if (_message != null) ...[
              const SizedBox(height: 12),
              AppInlineMessage(message: _message!),
            ],
          ],
        ),
      ),
    );
  }
}
