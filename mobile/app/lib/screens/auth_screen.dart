import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../models/user_profile.dart';
import '../widgets/app_fields.dart';
import '../widgets/screen_padding.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.api,
    required this.currentUser,
    required this.onLogin,
    required this.onProfileTap,
    this.sessionMessage,
  });

  final ApiClient api;
  final UserProfile? currentUser;
  final ValueChanged<UserProfile> onLogin;
  final VoidCallback onProfileTap;
  final String? sessionMessage;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _message;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final user = await widget.api.login(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
      );
      widget.onLogin(user);
      setState(() => _message = 'Sesion iniciada correctamente.');
    } catch (error) {
      setState(() => _message = 'Error: $error');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _requestPasswordReset() async {
    final email = _emailController.text.trim();

    if (email.isEmpty) {
      setState(() => _message = 'Escribe tu correo para recuperar tu contrasena.');
      return;
    }

    setState(() {
      _loading = true;
      _message = null;
    });

    try {
      await widget.api.requestPasswordReset(email: email);
      setState(
        () => _message =
            'Si el correo existe, enviaremos instrucciones para cambiar tu contrasena.',
      );
    } catch (error) {
      setState(() => _message = 'Error: $error');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = widget.currentUser;

    if (currentUser != null) {
      return _SignedInState(
        user: currentUser,
        onProfileTap: widget.onProfileTap,
      );
    }

    return ListView(
      padding: scrollScreenPadding(context),
      children: [
        const Text(
          'Acceso',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        const Text(
          'Inicia sesion para reportar mascotas y gestionar tus alertas.',
        ),
        if (widget.sessionMessage != null) ...[
          const SizedBox(height: 12),
          _StatusMessage(message: widget.sessionMessage!),
        ],
        const SizedBox(height: 18),
        AppTextField(
          controller: _emailController,
          label: 'Correo',
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 12),
        AppTextField(
          controller: _passwordController,
          label: 'Contrasena',
          icon: Icons.lock_outline,
          obscureText: true,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _loading ? null : _login(),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _loading ? null : _login,
          icon: _loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.lock_open),
          label: const Text('Iniciar sesion'),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: _loading ? null : _requestPasswordReset,
          child: const Text('Olvide mi contrasena'),
        ),
        if (_message != null) ...[
          const SizedBox(height: 12),
          _StatusMessage(message: _message!),
        ],
      ],
    );
  }
}

class _SignedInState extends StatelessWidget {
  const _SignedInState({required this.user, required this.onProfileTap});

  final UserProfile user;
  final VoidCallback onProfileTap;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.verified_user, size: 42),
            const SizedBox(height: 12),
            Text(
              user.displayName ?? user.email ?? 'Sesion activa',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Text(user.email ?? 'Tu sesion esta activa.'),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onProfileTap,
              icon: const Icon(Icons.person),
              label: const Text('Ver perfil'),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusMessage extends StatelessWidget {
  const _StatusMessage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(message),
    );
  }
}
