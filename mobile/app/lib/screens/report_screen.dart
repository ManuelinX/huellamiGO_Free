import 'dart:typed_data';

import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';

import '../api/api_client.dart';
import '../models/pet_report.dart';
import '../widgets/app_feedback.dart';
import '../widgets/app_fields.dart';
import '../widgets/huellamigo_ui.dart';
import '../widgets/screen_padding.dart';

class ReportScreen extends StatefulWidget {
  const ReportScreen({
    super.key,
    required this.api,
    required this.isSignedIn,
    required this.emailVerified,
    required this.onLoginTap,
    required this.onCreated,
  });

  final ApiClient api;
  final bool isSignedIn;
  final bool emailVerified;
  final VoidCallback onLoginTap;
  final ValueChanged<PetReport> onCreated;

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  static const _fallbackLocation = LatLng(19.41273, -99.16988);
  static const _shortFieldMaxLength = 32;
  static const _descriptionMaxLength = 128;

  final _formKey = GlobalKey<FormState>();
  final _mapController = MapController();
  final _nameController = TextEditingController();
  final _speciesController = TextEditingController();
  final _zoneController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _lastSeenPlaceController = TextEditingController();
  final _latitudeController = TextEditingController();
  final _longitudeController = TextEditingController();
  final _rewardAmountController = TextEditingController();
  final _rewardCurrencyController = TextEditingController(text: 'MXN');
  final _contactNameController = TextEditingController();
  final _preferredContactController = TextEditingController(
    text: 'Mensaje por HuellamiGO',
  );
  final _contactValueController = TextEditingController();

  bool _rewardEnabled = false;
  bool _rewardShowAmount = false;
  bool _isVulnerable = false;
  bool _isUrgent = false;
  bool _needsMedication = false;
  bool _publicWhatsapp = false;
  bool _submitting = false;
  bool _pickingPhoto = false;
  bool _locating = false;
  String _lifeStage = 'adult';
  Uint8List? _photoBytes;
  String? _photoName;
  String? _message;

  @override
  void initState() {
    super.initState();
    _latitudeController.addListener(_handleCoordinateTextChanged);
    _longitudeController.addListener(_handleCoordinateTextChanged);
  }

  @override
  void dispose() {
    _latitudeController.removeListener(_handleCoordinateTextChanged);
    _longitudeController.removeListener(_handleCoordinateTextChanged);
    _nameController.dispose();
    _speciesController.dispose();
    _zoneController.dispose();
    _descriptionController.dispose();
    _lastSeenPlaceController.dispose();
    _latitudeController.dispose();
    _longitudeController.dispose();
    _rewardAmountController.dispose();
    _rewardCurrencyController.dispose();
    _contactNameController.dispose();
    _preferredContactController.dispose();
    _contactValueController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!widget.isSignedIn) {
      widget.onLoginTap();
      return;
    }

    if (!widget.emailVerified) {
      setState(() {
        _message = 'Verifica tu correo para publicar una alerta.';
      });
      return;
    }

    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_photoBytes == null) {
      setState(() {
        _message = 'Selecciona una foto de la mascota para publicar.';
      });
      return;
    }

    final selectedLocation = _selectedLocation;
    if (selectedLocation == null) {
      setState(() {
        _message = 'Marca una ubicacion aproximada en el mapa.';
      });
      return;
    }

    setState(() {
      _submitting = true;
      _message = null;
    });

    try {
      final photoUrl = await _uploadSelectedPhoto();
      final report = await widget.api.createReport({
        'pet_name': _nameController.text.trim(),
        'pet_type': _speciesController.text.trim(),
        'description': _descriptionController.text.trim(),
        'zone': _zoneController.text.trim(),
        'last_seen_place': _lastSeenPlaceController.text.trim(),
        'last_seen_lat': selectedLocation.latitude,
        'last_seen_lng': selectedLocation.longitude,
        'reward_enabled': _rewardEnabled,
        'reward_show_amount': _rewardEnabled && _rewardShowAmount,
        'reward_amount':
            _rewardEnabled && _rewardAmountController.text.trim().isNotEmpty
            ? double.parse(_rewardAmountController.text.trim())
            : null,
        'reward_currency': _rewardCurrencyController.text.trim().isEmpty
            ? 'MXN'
            : _rewardCurrencyController.text.trim(),
        'contact_name': _emptyToNull(_contactNameController.text),
        'preferred_contact': _preferredContactController.text.trim().isEmpty
            ? 'Mensaje por HuellamiGO'
            : _preferredContactController.text.trim(),
        'contact_value': _emptyToNull(_contactValueController.text),
        'public_whatsapp': _publicWhatsapp,
        'is_vulnerable': _isVulnerable,
        'is_urgent': _isUrgent,
        'needs_medication': _needsMedication,
        'pet_life_stage': _lifeStage,
        'photo_url': photoUrl,
        'status': 'active',
      });

      _clearForm();
      setState(() => _message = 'Reporte creado correctamente.');
      widget.onCreated(report);
    } catch (error) {
      setState(() => _message = 'Error: $error');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  void _clearForm() {
    _nameController.clear();
    _speciesController.clear();
    _zoneController.clear();
    _descriptionController.clear();
    _lastSeenPlaceController.clear();
    _rewardAmountController.clear();
    _contactNameController.clear();
    _contactValueController.clear();
    _rewardCurrencyController.text = 'MXN';
    _preferredContactController.text = 'Mensaje por HuellamiGO';
    _latitudeController.clear();
    _longitudeController.clear();
    _rewardEnabled = false;
    _rewardShowAmount = false;
    _isVulnerable = false;
    _isUrgent = false;
    _needsMedication = false;
    _lifeStage = 'adult';
    _publicWhatsapp = false;
    _photoBytes = null;
    _photoName = null;
    _moveMapToCurrentCoordinates();
  }

  LatLng? get _selectedLocation {
    final latitude = double.tryParse(_latitudeController.text.trim());
    final longitude = double.tryParse(_longitudeController.text.trim());
    if (latitude == null || longitude == null) {
      return null;
    }
    return LatLng(latitude, longitude);
  }

  void _handleCoordinateTextChanged() {
    if (!mounted) {
      return;
    }
    setState(() {});
  }

  void _setCoordinates(LatLng location, {bool moveMap = true}) {
    _latitudeController.text = location.latitude.toStringAsFixed(6);
    _longitudeController.text = location.longitude.toStringAsFixed(6);
    if (moveMap) {
      _mapController.move(location, 15);
    }
  }

  void _moveMapToCurrentCoordinates() {
    _mapController.move(_selectedLocation ?? _fallbackLocation, 15);
  }

  Future<String?> _uploadSelectedPhoto() async {
    final photoBytes = _photoBytes;
    if (photoBytes == null) {
      return null;
    }

    final uploaded = await widget.api.uploadPetPhoto(
      bytes: photoBytes,
      filename: _photoName ?? 'huellamigo-photo.webp',
    );
    return uploaded.publicUrl;
  }

  Future<void> _pickPhoto() async {
    setState(() {
      _pickingPhoto = true;
      _message = null;
    });

    try {
      final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
      if (picked == null) {
        return;
      }

      final compressed = await FlutterImageCompress.compressWithFile(
        picked.path,
        format: CompressFormat.webp,
        quality: 82,
        minWidth: 1400,
        minHeight: 1400,
      );

      if (compressed == null || compressed.isEmpty) {
        throw const ApiException('No se pudo preparar la foto.');
      }

      setState(() {
        _photoBytes = Uint8List.fromList(compressed);
        _photoName = '${DateTime.now().millisecondsSinceEpoch}.webp';
        _message = 'Foto lista para subir.';
      });
    } catch (error) {
      setState(() => _message = 'No se pudo seleccionar la foto: $error');
    } finally {
      if (mounted) {
        setState(() => _pickingPhoto = false);
      }
    }
  }

  void _removePhoto() {
    setState(() {
      _photoBytes = null;
      _photoName = null;
      _message = null;
    });
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
        _message = 'Ubicacion actual aplicada.';
      });
    } catch (error) {
      setState(() => _message = 'No se pudo obtener ubicacion: $error');
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
    if (!widget.isSignedIn) {
      return _SignedOutReport(onLoginTap: widget.onLoginTap);
    }

    return Form(
      key: _formKey,
      child: ListView(
        padding: scrollScreenPadding(context),
        children: [
          const AppEyebrow('Reporte comunitario'),
          const SizedBox(height: 8),
          Text(
            'Crear reporte',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 18),
          AppSectionPanel(
            number: 1,
            title: 'Foto para reconocerla',
            subtitle: 'Una imagen clara ayuda a validar y compartir la alerta.',
            children: [
              _PhotoPickerPanel(
                photoBytes: _photoBytes,
                picking: _pickingPhoto,
                onPick: _pickPhoto,
                onRemove: _removePhoto,
              ),
            ],
          ),
          const SizedBox(height: 18),
          AppSectionPanel(
            number: 2,
            title: 'Datos y ubicacion',
            subtitle: 'Lo minimo para que otras personas puedan buscar cerca.',
            children: [
              AppTextField(
                controller: _nameController,
                label: 'Nombre de mascota',
                icon: Icons.pets,
                validator: (value) => _requiredMax(value, _shortFieldMaxLength),
              ),
              const SizedBox(height: 12),
              AppTextField(
                controller: _speciesController,
                label: 'Especie',
                hintText: 'Perro, gato, ave...',
                icon: Icons.category,
                validator: (value) => _requiredMax(value, _shortFieldMaxLength),
              ),
              const SizedBox(height: 12),
              AppTextField(
                controller: _zoneController,
                label: 'Zona',
                icon: Icons.place,
                validator: (value) => _requiredMax(value, _shortFieldMaxLength),
              ),
              const SizedBox(height: 12),
              AppTextField(
                controller: _lastSeenPlaceController,
                label: 'Ultima vez visto',
                hintText: 'Parque, colonia, calle...',
                icon: Icons.schedule,
                validator: (value) => _requiredMax(value, _shortFieldMaxLength),
              ),
              const SizedBox(height: 12),
              AppTextField(
                controller: _descriptionController,
                label: 'Descripcion',
                icon: Icons.notes,
                maxLines: 4,
                validator: (value) =>
                    _optionalMax(value, _descriptionMaxLength),
              ),
              const SizedBox(height: 16),
              _ReportLocationPicker(
                mapController: _mapController,
                location: _selectedLocation,
                onLocationChanged: _setCoordinates,
              ),
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerLeft,
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: _locating ? null : _useCurrentLocation,
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
                      onPressed: _moveMapToCurrentCoordinates,
                      icon: const Icon(Icons.center_focus_strong),
                      label: const Text('Centrar mapa'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: AppTextField(
                      controller: _latitudeController,
                      label: 'Latitud',
                      icon: Icons.my_location,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                        signed: true,
                      ),
                      validator: _validNumber,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppTextField(
                      controller: _longitudeController,
                      label: 'Longitud',
                      icon: Icons.explore,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                        signed: true,
                      ),
                      validator: _validNumber,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),
          AppSectionPanel(
            number: 3,
            title: 'Condicion de la mascota',
            subtitle: 'Estas senales ayudan a priorizar alertas cercanas.',
            children: [
              DropdownButtonFormField<String>(
                initialValue: _lifeStage,
                decoration: const InputDecoration(
                  labelText: 'Etapa de vida',
                  prefixIcon: Icon(Icons.timeline),
                ),
                items: const [
                  DropdownMenuItem(value: 'puppy', child: Text('Cachorro')),
                  DropdownMenuItem(value: 'adult', child: Text('Adulto')),
                  DropdownMenuItem(
                    value: 'senior',
                    child: Text('Adulto mayor'),
                  ),
                ],
                onChanged: (value) =>
                    setState(() => _lifeStage = value ?? 'adult'),
              ),
              CheckboxListTile(
                value: _isVulnerable,
                onChanged: (value) =>
                    setState(() => _isVulnerable = value ?? false),
                title: const Text(
                  'Tiene movilidad limitada o alguna discapacidad',
                ),
                contentPadding: EdgeInsets.zero,
              ),
              CheckboxListTile(
                value: _isUrgent,
                onChanged: (value) =>
                    setState(() => _isUrgent = value ?? false),
                title: const Text('Esta herida, enferma o en recuperacion'),
                contentPadding: EdgeInsets.zero,
              ),
              CheckboxListTile(
                value: _needsMedication,
                onChanged: (value) =>
                    setState(() => _needsMedication = value ?? false),
                title: const Text('Necesita medicamento o cuidados especiales'),
                contentPadding: EdgeInsets.zero,
              ),
            ],
          ),
          const SizedBox(height: 18),
          AppSectionPanel(
            number: 4,
            title: 'Recompensa',
            subtitle: 'Opcional. Puedes ocultar el monto si prefieres.',
            children: [
              SwitchListTile(
                value: _rewardEnabled,
                onChanged: (value) => setState(() => _rewardEnabled = value),
                title: const Text('Ofrecer recompensa'),
                contentPadding: EdgeInsets.zero,
              ),
              if (_rewardEnabled) ...[
                CheckboxListTile(
                  value: _rewardShowAmount,
                  onChanged: (value) =>
                      setState(() => _rewardShowAmount = value ?? false),
                  title: const Text('Mostrar monto publicamente'),
                  contentPadding: EdgeInsets.zero,
                ),
                Row(
                  children: [
                    Expanded(
                      child: AppTextField(
                        controller: _rewardAmountController,
                        label: 'Monto',
                        icon: Icons.paid,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        validator: _optionalPositiveNumber,
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 112,
                      child: AppTextField(
                        controller: _rewardCurrencyController,
                        label: 'Moneda',
                        icon: Icons.attach_money,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
          const SizedBox(height: 18),
          AppSectionPanel(
            number: 5,
            title: 'Contacto',
            subtitle: 'Decide como quieres recibir ayuda sin exponer de mas.',
            children: [
              AppTextField(
                controller: _contactNameController,
                label: 'Nombre de contacto opcional',
                hintText: 'Ej. Lucia',
                icon: Icons.badge_outlined,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _preferredContactController.text,
                decoration: const InputDecoration(
                  labelText: 'Metodo preferido',
                  prefixIcon: Icon(Icons.contact_support_outlined),
                ),
                items: const [
                  DropdownMenuItem(
                    value: 'Mensaje por HuellamiGO',
                    child: Text('Mensaje por HuellamiGO'),
                  ),
                  DropdownMenuItem(
                    value: 'Notificacion de HuellamiGO',
                    child: Text('Notificacion de HuellamiGO'),
                  ),
                  DropdownMenuItem(value: 'WhatsApp', child: Text('WhatsApp')),
                  DropdownMenuItem(value: 'Llamada', child: Text('Llamada')),
                  DropdownMenuItem(value: 'Email', child: Text('Email')),
                ],
                onChanged: (value) {
                  _preferredContactController.text =
                      value ?? 'Mensaje por HuellamiGO';
                },
              ),
              const SizedBox(height: 12),
              AppTextField(
                controller: _contactValueController,
                label: 'WhatsApp o email opcional',
                hintText: 'Solo si quieres compartirlo',
                icon: Icons.alternate_email,
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                value: _publicWhatsapp,
                onChanged: (value) => setState(() => _publicWhatsapp = value),
                title: const Text('Mostrar WhatsApp publicamente'),
                subtitle: const Text(
                  'Por ahora el contacto queda protegido si esta apagado.',
                ),
                contentPadding: EdgeInsets.zero,
              ),
            ],
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _submitting ? null : _submit,
            icon: _submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.add_alert),
            label: Text(
              widget.emailVerified
                  ? 'Publicar reporte'
                  : 'Verifica tu correo para publicar',
            ),
          ),
          if (_message != null) ...[
            const SizedBox(height: 12),
            AppInlineMessage(message: _message!),
          ],
        ],
      ),
    );
  }

  String? _requiredMax(String? value, int maxLength) {
    if (value == null || value.trim().isEmpty) {
      return 'Campo obligatorio';
    }
    if (value.trim().length > maxLength) {
      return 'Maximo $maxLength caracteres';
    }
    return null;
  }

  String? _optionalMax(String? value, int maxLength) {
    if (value == null || value.trim().isEmpty) {
      return null;
    }
    if (value.trim().length > maxLength) {
      return 'Maximo $maxLength caracteres';
    }
    return null;
  }

  String? _validNumber(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Marca una ubicacion';
    }
    if (double.tryParse(value.trim()) == null) {
      return 'Numero invalido';
    }
    return null;
  }

  String? _optionalPositiveNumber(String? value) {
    if (value == null || value.trim().isEmpty) {
      return null;
    }
    final parsed = double.tryParse(value.trim());
    if (parsed == null || parsed < 0) {
      return 'Monto invalido';
    }
    if (_rewardShowAmount && parsed < 10) {
      return 'Minimo 10 MXN';
    }
    return null;
  }
}

class _PhotoPickerPanel extends StatelessWidget {
  const _PhotoPickerPanel({
    required this.photoBytes,
    required this.picking,
    required this.onPick,
    required this.onRemove,
  });

  final Uint8List? photoBytes;
  final bool picking;
  final VoidCallback onPick;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final bytes = photoBytes;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: HuellamiGOColors.mint,
        border: Border.all(color: HuellamiGOColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (bytes == null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                OutlinedButton.icon(
                  onPressed: picking ? null : onPick,
                  icon: picking
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.photo_library_outlined),
                  label: const Text('Seleccionar foto obligatoria'),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Necesitas una foto para publicar una alerta.',
                  textAlign: TextAlign.center,
                ),
              ],
            )
          else ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(
                aspectRatio: 16 / 10,
                child: Image.memory(bytes, fit: BoxFit.cover),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Foto lista',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                TextButton.icon(
                  onPressed: onRemove,
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Quitar'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ReportLocationPicker extends StatelessWidget {
  const _ReportLocationPicker({
    required this.mapController,
    required this.location,
    required this.onLocationChanged,
  });

  final MapController mapController;
  final LatLng? location;
  final ValueChanged<LatLng> onLocationChanged;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        height: 220,
        child: Stack(
          children: [
            FlutterMap(
              mapController: mapController,
              options: MapOptions(
                initialCenter: location ?? _ReportScreenState._fallbackLocation,
                initialZoom: 15,
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
                    if (location != null)
                      Marker(
                        point: location!,
                        width: 48,
                        height: 48,
                        child: Icon(
                          Icons.location_on,
                          size: 44,
                          color: HuellamiGOColors.coral,
                          shadows: const [
                            Shadow(
                              color: Colors.black38,
                              blurRadius: 8,
                              offset: Offset(0, 3),
                            ),
                          ],
                        ),
                      )
                    else
                      Marker(
                        point: _ReportScreenState._fallbackLocation,
                        width: 220,
                        height: 42,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: HuellamiGOColors.paper.withValues(
                              alpha: 0.94,
                            ),
                            border: Border.all(color: HuellamiGOColors.line),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Center(
                            child: Text(
                              'Toca el mapa para marcar ubicacion',
                              textAlign: TextAlign.center,
                            ),
                          ),
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
            Positioned(
              left: 10,
              right: 10,
              top: 10,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: HuellamiGOColors.paper.withValues(alpha: 0.94),
                  border: Border.all(color: HuellamiGOColors.line),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  child: Text(
                    'Toca el mapa para marcar donde se vio por ultima vez.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignedOutReport extends StatelessWidget {
  const _SignedOutReport({required this.onLoginTap});

  final VoidCallback onLoginTap;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_outline, size: 42),
            const SizedBox(height: 12),
            const Text(
              'Inicia sesion para reportar',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            const Text(
              'Necesitas una cuenta para crear alertas y poder gestionarlas despues.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onLoginTap,
              icon: const Icon(Icons.person),
              label: const Text('Ir a perfil'),
            ),
          ],
        ),
      ),
    );
  }
}
