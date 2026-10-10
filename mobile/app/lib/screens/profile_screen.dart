import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../api/api_client.dart';
import '../models/notification_preferences.dart';
import '../models/pet_report.dart';
import '../models/user_profile.dart';
import '../widgets/app_feedback.dart';
import '../widgets/app_fields.dart';
import '../widgets/huellamigo_ui.dart';
import '../widgets/pet_widgets.dart';
import '../widgets/screen_padding.dart';
import 'manage_report_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.api,
    required this.user,
    required this.loading,
    required this.onLogin,
    required this.onLogout,
    required this.onRefresh,
    this.message,
  });

  final ApiClient api;
  final UserProfile? user;
  final bool loading;
  final String? message;
  final ValueChanged<UserProfile> onLogin;
  final Future<void> Function() onLogout;
  final Future<void> Function() onRefresh;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  Future<List<PetReport>>? _myReportsFuture;
  bool _loginLoading = false;
  String? _loginMessage;

  @override
  void initState() {
    super.initState();
    _syncReportsFuture();
  }

  @override
  void didUpdateWidget(ProfileScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user?.id != widget.user?.id) {
      _syncReportsFuture();
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _syncReportsFuture() {
    _myReportsFuture = widget.user == null ? null : widget.api.getMyReports();
  }

  Future<void> _refreshProfile() async {
    await widget.onRefresh();
    if (mounted) {
      setState(_syncReportsFuture);
    }
  }

  Future<void> _login() async {
    setState(() {
      _loginLoading = true;
      _loginMessage = null;
    });

    try {
      final user = await widget.api.login(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
      );
      widget.onLogin(user);
      if (mounted) {
        setState(() => _loginMessage = 'Sesion iniciada correctamente.');
      }
    } catch (error) {
      if (mounted) {
        setState(() => _loginMessage = 'Error: $error');
      }
    } finally {
      if (mounted) {
        setState(() => _loginLoading = false);
      }
    }
  }

  Future<void> _requestPasswordReset() async {
    final email = _emailController.text.trim();

    if (email.isEmpty) {
      setState(
        () => _loginMessage = 'Escribe tu correo para recuperar tu contrasena.',
      );
      return;
    }

    setState(() {
      _loginLoading = true;
      _loginMessage = null;
    });

    try {
      await widget.api.requestPasswordReset(email: email);
      if (mounted) {
        setState(
          () => _loginMessage =
              'Si el correo existe, enviaremos instrucciones para cambiar tu contrasena.',
        );
      }
    } catch (error) {
      if (mounted) {
        setState(() => _loginMessage = 'Error: $error');
      }
    } finally {
      if (mounted) {
        setState(() => _loginLoading = false);
      }
    }
  }

  Future<void> _openManageReport(PetReport report) async {
    if (report.manageToken == null || report.manageToken!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('No hay token privado para gestionar ${report.name}.'),
        ),
      );
      return;
    }

    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) =>
            ManageReportScreen(api: widget.api, initialReport: report),
      ),
    );

    if (changed == true && mounted) {
      setState(_syncReportsFuture);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.loading) {
      return const AppLoadingState(
        center: true,
        title: 'Cargando perfil',
        message: 'Revisando tu sesion.',
      );
    }

    final currentUser = widget.user;
    if (currentUser == null) {
      return _SignedOutProfile(
        emailController: _emailController,
        passwordController: _passwordController,
        loading: _loginLoading,
        message: widget.message,
        loginMessage: _loginMessage,
        onLogin: _login,
        onPasswordReset: _requestPasswordReset,
      );
    }

    return RefreshIndicator(
      onRefresh: _refreshProfile,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: scrollScreenPadding(context),
        children: [
          _ProfileHeader(user: currentUser),
          const SizedBox(height: 16),
          _ProfileInfo(user: currentUser),
          const SizedBox(height: 20),
          _AlertPreferencesSection(api: widget.api),
          const SizedBox(height: 20),
          _MyReportsSection(
            reportsFuture: _myReportsFuture ?? Future.value(<PetReport>[]),
            onRetry: () => setState(_syncReportsFuture),
            onManageTap: _openManageReport,
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: widget.onLogout,
            icon: const Icon(Icons.logout),
            label: const Text('Cerrar sesion'),
          ),
        ],
      ),
    );
  }
}

class _AlertPreferencesSection extends StatefulWidget {
  const _AlertPreferencesSection({required this.api});

  final ApiClient api;

  @override
  State<_AlertPreferencesSection> createState() =>
      _AlertPreferencesSectionState();
}

class _AlertPreferencesSectionState extends State<_AlertPreferencesSection> {
  static const _fallbackLocation = LatLng(19.41273, -99.16988);

  final _mapController = MapController();
  final _placeController = TextEditingController();
  final _latController = TextEditingController();
  final _lngController = TextEditingController();
  Future<NotificationPreferences>? _future;
  NotificationPreferences? _preferences;
  bool _saving = false;
  bool _locating = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _future = _loadPreferences();
    _latController.addListener(_handleCoordinateTextChanged);
    _lngController.addListener(_handleCoordinateTextChanged);
  }

  @override
  void dispose() {
    _latController.removeListener(_handleCoordinateTextChanged);
    _lngController.removeListener(_handleCoordinateTextChanged);
    _placeController.dispose();
    _latController.dispose();
    _lngController.dispose();
    super.dispose();
  }

  Future<NotificationPreferences> _loadPreferences() async {
    final preferences = await widget.api.getNotificationPreferences();
    _applyPreferences(preferences);
    return preferences;
  }

  void _applyPreferences(NotificationPreferences preferences) {
    _preferences = preferences;
    _placeController.text = preferences.alertPlaceLabel ?? '';
    _latController.text = preferences.alertLat?.toStringAsFixed(6) ?? '';
    _lngController.text = preferences.alertLng?.toStringAsFixed(6) ?? '';
  }

  LatLng? get _selectedLocation {
    final latitude = double.tryParse(_latController.text.trim());
    final longitude = double.tryParse(_lngController.text.trim());
    if (latitude == null || longitude == null) {
      return null;
    }
    return LatLng(latitude, longitude);
  }

  void _handleCoordinateTextChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _setCoordinates(LatLng location, {bool moveMap = true}) {
    _latController.text = location.latitude.toStringAsFixed(6);
    _lngController.text = location.longitude.toStringAsFixed(6);
    if (moveMap) {
      _mapController.move(location, _mapController.camera.zoom);
    }
  }

  void _centerMap() {
    _mapController.move(
      _selectedLocation ?? _fallbackLocation,
      _mapController.camera.zoom,
    );
  }

  void _retry() {
    setState(() {
      _message = null;
      _future = _loadPreferences();
    });
  }

  Future<void> _save() async {
    final current = _preferences;
    if (current == null) {
      return;
    }

    final alertLat = double.tryParse(_latController.text.trim());
    final alertLng = double.tryParse(_lngController.text.trim());
    final hasPartialLocation =
        _latController.text.trim().isNotEmpty ||
        _lngController.text.trim().isNotEmpty;

    if (hasPartialLocation && (alertLat == null || alertLng == null)) {
      setState(() => _message = 'Escribe latitud y longitud validas.');
      return;
    }

    if (alertLat != null && (alertLat < -90 || alertLat > 90)) {
      setState(() => _message = 'La latitud debe estar entre -90 y 90.');
      return;
    }

    if (alertLng != null && (alertLng < -180 || alertLng > 180)) {
      setState(() => _message = 'La longitud debe estar entre -180 y 180.');
      return;
    }

    setState(() {
      _saving = true;
      _message = null;
    });

    try {
      final saved = await widget.api.updateNotificationPreferences(
        NotificationPreferences(
          notifySightingUpdates: current.notifySightingUpdates,
          notifyNearbyReports: current.notifyNearbyReports,
          radiusKm: current.radiusKm,
          alertLat: alertLat,
          alertLng: alertLng,
          alertPlaceLabel: alertLat == null && alertLng == null
              ? null
              : _emptyToNull(_placeController.text),
          locationSource: 'manual',
          exists: current.exists,
        ),
      );

      if (mounted) {
        setState(() {
          _applyPreferences(saved);
          _message = 'Preferencias guardadas.';
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => _message = 'Error: $error');
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _locating = true;
      _message = null;
    });

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw const ApiException('Activa la ubicacion del dispositivo.');
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        throw const ApiException('Permiso de ubicacion denegado.');
      }

      if (permission == LocationPermission.deniedForever) {
        throw const ApiException(
          'Permiso de ubicacion bloqueado. Activalo desde ajustes.',
        );
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      setState(() {
        _setCoordinates(LatLng(position.latitude, position.longitude));
        if (_placeController.text.trim().isEmpty) {
          _placeController.text = 'Mi zona actual';
        }
        _message = 'Ubicacion aplicada. Guarda para activar esta zona.';
      });
    } catch (error) {
      if (mounted) {
        setState(() => _message = 'No se pudo obtener ubicacion: $error');
      }
    } finally {
      if (mounted) {
        setState(() => _locating = false);
      }
    }
  }

  String? _emptyToNull(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<NotificationPreferences>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const AppLoadingState(
            padding: 24,
            title: 'Cargando alertas',
            message: 'Revisando tus preferencias.',
          );
        }

        if (snapshot.hasError) {
          return AppMessageState(
            icon: Icons.notifications_off_outlined,
            title: friendlyErrorTitle(
              snapshot.error,
              fallback: 'No se pudieron cargar tus alertas',
            ),
            message: friendlyErrorMessage(snapshot.error),
            action: OutlinedButton.icon(
              onPressed: _retry,
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar'),
            ),
          );
        }

        final preferences = _preferences ?? snapshot.data;
        if (preferences == null) {
          return const SizedBox.shrink();
        }

        return AppSectionPanel(
          number: 1,
          title: 'Preferencias de alertas',
          subtitle: 'Decide que avisos quieres recibir y desde que zona.',
          children: [
            SwitchListTile(
              value: preferences.notifyNearbyReports,
              onChanged: _saving
                  ? null
                  : (value) => setState(() {
                      _preferences = preferences.copyWith(
                        notifyNearbyReports: value,
                      );
                    }),
              title: const Text('Reportes cercanos'),
              subtitle: const Text(
                'Avisos de mascotas perdidas cerca de tu zona.',
              ),
              contentPadding: EdgeInsets.zero,
            ),
            SwitchListTile(
              value: preferences.notifySightingUpdates,
              onChanged: _saving
                  ? null
                  : (value) => setState(() {
                      _preferences = preferences.copyWith(
                        notifySightingUpdates: value,
                      );
                    }),
              title: const Text('Avistamientos de mis reportes'),
              subtitle: const Text('Avisos cuando alguien agrega una pista.'),
              contentPadding: EdgeInsets.zero,
            ),
            const SizedBox(height: 8),
            AppTextField(
              controller: _placeController,
              label: 'Nombre de zona',
              hintText: 'Casa, colonia, trabajo...',
              icon: Icons.place_outlined,
            ),
            const SizedBox(height: 12),
            const Text(
              'Toca el mapa para elegir tu zona base de alertas.',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            _AlertLocationMiniMap(
              mapController: _mapController,
              location: _selectedLocation,
              onLocationChanged: _setCoordinates,
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: AppTextField(
                    controller: _latController,
                    label: 'Latitud',
                    icon: Icons.my_location,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                      signed: true,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: AppTextField(
                    controller: _lngController,
                    label: 'Longitud',
                    icon: Icons.explore,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                      signed: true,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: _locating || _saving ? null : _useCurrentLocation,
                  icon: _locating
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.my_location),
                  label: const Text('Usar mi ubicacion'),
                ),
                OutlinedButton.icon(
                  onPressed: _saving ? null : _centerMap,
                  icon: const Icon(Icons.center_focus_strong),
                  label: const Text('Centrar mapa'),
                ),
                FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save_outlined),
                  label: const Text('Guardar alertas'),
                ),
              ],
            ),
            if (_message != null) ...[
              const SizedBox(height: 12),
              AppInlineMessage(message: _message!),
            ],
          ],
        );
      },
    );
  }
}

class _AlertLocationMiniMap extends StatelessWidget {
  const _AlertLocationMiniMap({
    required this.mapController,
    required this.location,
    required this.onLocationChanged,
  });

  final MapController mapController;
  final LatLng? location;
  final ValueChanged<LatLng> onLocationChanged;

  @override
  Widget build(BuildContext context) {
    final center = location ?? _AlertPreferencesSectionState._fallbackLocation;

    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        height: 190,
        child: Stack(
          children: [
            FlutterMap(
              mapController: mapController,
              options: MapOptions(
                initialCenter: center,
                initialZoom: 14,
                minZoom: 4,
                maxZoom: 18,
                onTap: (_, point) => onLocationChanged(point),
              ),
              children: [
                TileLayer(
                  minZoom: 4,
                  maxZoom: 18,
                  urlTemplate:
                      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                  subdomains: const ['a', 'b', 'c', 'd'],
                  userAgentPackageName: 'com.huellamigo.mobile',
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: center,
                      width: location == null ? 220 : 48,
                      height: location == null ? 42 : 48,
                      child: location == null
                          ? DecoratedBox(
                              decoration: BoxDecoration(
                                color: HuellamiGOColors.paper.withValues(
                                  alpha: 0.94,
                                ),
                                border: Border.all(
                                  color: HuellamiGOColors.line,
                                ),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Center(
                                child: Text(
                                  'Toca el mapa para fijar zona',
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            )
                          : Icon(
                              Icons.notifications_active,
                              size: 40,
                              color: HuellamiGOColors.coral,
                              shadows: const [
                                Shadow(
                                  color: Colors.black38,
                                  blurRadius: 8,
                                  offset: Offset(0, 3),
                                ),
                              ],
                            ),
                    ),
                  ],
                ),
                RichAttributionWidget(
                  attributions: [
                    TextSourceAttribution('OpenStreetMap contributors'),
                    TextSourceAttribution('CARTO'),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SignedOutProfile extends StatelessWidget {
  const _SignedOutProfile({
    required this.emailController,
    required this.passwordController,
    required this.loading,
    required this.onLogin,
    required this.onPasswordReset,
    this.message,
    this.loginMessage,
  });

  final TextEditingController emailController;
  final TextEditingController passwordController;
  final bool loading;
  final String? message;
  final String? loginMessage;
  final VoidCallback onLogin;
  final VoidCallback onPasswordReset;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: scrollScreenPadding(context),
      children: [
        const Text(
          'Perfil',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        const Text('Inicia sesion para ver tu perfil y gestionar reportes.'),
        if (message != null) ...[
          const SizedBox(height: 12),
          AppInlineMessage(message: message!),
        ],
        const SizedBox(height: 18),
        AppTextField(
          controller: emailController,
          label: 'Correo',
          icon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 12),
        AppTextField(
          controller: passwordController,
          label: 'Contrasena',
          icon: Icons.lock_outline,
          obscureText: true,
          onSubmitted: (_) => loading ? null : onLogin(),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: loading ? null : onLogin,
          icon: loading
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
          onPressed: loading ? null : onPasswordReset,
          child: const Text('Olvide mi contrasena'),
        ),
        if (loginMessage != null) ...[
          const SizedBox(height: 12),
          AppInlineMessage(message: loginMessage!),
        ],
      ],
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.user});

  final UserProfile user;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colors.primaryContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          ClipOval(
            child: CachedAppImage(
              imageUrl: user.avatarUrl,
              width: 60,
              height: 60,
              fit: BoxFit.cover,
              icon: Icons.person,
              cacheWidth: 60,
              cacheHeight: 60,
              backgroundColor: colors.primary,
              iconColor: colors.onPrimary,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.displayName ?? 'Usuario HuellamiGO',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.onPrimaryContainer,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  user.email ?? 'Correo no disponible',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.onPrimaryContainer),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileInfo extends StatelessWidget {
  const _ProfileInfo({required this.user});

  final UserProfile user;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            _InfoRow(label: 'Usuario', value: user.username ?? 'Sin usuario'),
            _InfoRow(
              label: 'Correo verificado',
              value: user.emailVerified ? 'Si' : 'No',
            ),
            _InfoRow(label: 'Ciudad', value: user.city ?? 'Sin ciudad'),
            _InfoRow(label: 'Estado', value: user.state ?? 'Sin estado'),
          ],
        ),
      ),
    );
  }
}

class _MyReportsSection extends StatelessWidget {
  const _MyReportsSection({
    required this.reportsFuture,
    required this.onRetry,
    required this.onManageTap,
  });

  final Future<List<PetReport>> reportsFuture;
  final VoidCallback onRetry;
  final ValueChanged<PetReport> onManageTap;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<PetReport>>(
      future: reportsFuture,
      builder: (context, snapshot) {
        final reports = snapshot.data ?? <PetReport>[];

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Mis reportes',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                ),
                Chip(
                  avatar: const Icon(Icons.assignment, size: 17),
                  label: Text('${reports.length}'),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (snapshot.connectionState != ConnectionState.done)
              const AppLoadingState(padding: 24)
            else if (snapshot.hasError)
              AppMessageState(
                icon: Icons.cloud_off,
                title: friendlyErrorTitle(
                  snapshot.error,
                  fallback: 'No se pudieron cargar tus reportes',
                ),
                message: friendlyErrorMessage(snapshot.error),
                action: OutlinedButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Reintentar'),
                ),
              )
            else if (reports.isEmpty)
              const AppMessageState(
                icon: Icons.assignment_outlined,
                title: 'Aun no tienes reportes',
                message:
                    'Cuando reportes una mascota, aparecera aqui para gestionarla.',
              )
            else
              ...reports.map(
                (report) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _MyReportCard(
                    report: report,
                    onManageTap: () => onManageTap(report),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _MyReportCard extends StatelessWidget {
  const _MyReportCard({required this.report, required this.onManageTap});

  final PetReport report;
  final VoidCallback onManageTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: colors.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                PetThumbnail(photoUrl: report.photoUrl, size: 40),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        report.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        '${report.species} - ${report.zone}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                AppInfoPill(icon: Icons.flag, label: report.status),
                AppInfoPill(
                  icon: Icons.visibility,
                  label: '${report.sightingsCount} avist.',
                ),
              ],
            ),
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                onPressed: onManageTap,
                icon: const Icon(Icons.settings, size: 18),
                label: const Text('Gestionar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
