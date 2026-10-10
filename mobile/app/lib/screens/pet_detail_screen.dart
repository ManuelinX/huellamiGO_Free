import 'dart:typed_data';

import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../models/pet_report.dart';
import '../models/report_status.dart';
import '../models/sighting.dart';
import '../widgets/app_feedback.dart';
import '../widgets/huellamigo_ui.dart';
import '../widgets/pet_widgets.dart';
import '../widgets/screen_padding.dart';

class PetDetailScreen extends StatefulWidget {
  const PetDetailScreen({
    super.key,
    required this.api,
    required this.initialReport,
    this.focusSightingForm = false,
  });

  final ApiClient api;
  final PetReport initialReport;
  final bool focusSightingForm;

  @override
  State<PetDetailScreen> createState() => _PetDetailScreenState();
}

class _PetDetailScreenState extends State<PetDetailScreen> {
  static const _sightingDelay = Duration(seconds: 60);

  final _sightingFormKey = GlobalKey<FormState>();
  final _zoneController = TextEditingController();
  final _seenAtController = TextEditingController();
  final _commentController = TextEditingController();
  final _contactController = TextEditingController();
  late final TextEditingController _latitudeController;
  late final TextEditingController _longitudeController;
  late Future<_PetDetailData> _detailFuture;
  bool _submittingSighting = false;
  bool _pickingSightingPhoto = false;
  bool _locatingSighting = false;
  Uint8List? _sightingPhotoBytes;
  String? _sightingPhotoName;
  String? _sightingMessage;

  @override
  void initState() {
    super.initState();
    _latitudeController = TextEditingController(
      text: (widget.initialReport.latitude ?? 19.41273).toString(),
    );
    _longitudeController = TextEditingController(
      text: (widget.initialReport.longitude ?? -99.16988).toString(),
    );
    _detailFuture = _loadDetail();
  }

  @override
  void dispose() {
    _zoneController.dispose();
    _seenAtController.dispose();
    _commentController.dispose();
    _contactController.dispose();
    _latitudeController.dispose();
    _longitudeController.dispose();
    super.dispose();
  }

  Future<_PetDetailData> _loadDetail() async {
    PetReport report;

    try {
      report = await widget.api.getReport(widget.initialReport.id);
    } on ApiException catch (error) {
      if (error.statusCode != 404 ||
          !ReportStatus.isReunited(widget.initialReport.status)) {
        rethrow;
      }
      report = widget.initialReport;
    }

    final sightings = await widget.api.getSightings(report.id);
    return _PetDetailData(report: report, sightings: sightings);
  }

  Future<void> _refresh() async {
    setState(() => _detailFuture = _loadDetail());
    await _detailFuture;
  }

  Future<void> _submitSighting(PetReport report) async {
    if (ReportStatus.isReunited(report.status)) {
      setState(() {
        _sightingMessage =
            'Este reporte ya fue marcado como reunido y no recibe nuevos Lo vi.';
      });
      return;
    }

    if (!_sightingFormKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _submittingSighting = true;
      _sightingMessage = null;
    });

    try {
      final user = await widget.api.getMe();
      if (!user.emailVerified) {
        throw const ApiException('Verifica tu correo para enviar un Lo vi.');
      }

      final storageKey = 'huellamigo:last-sighting:${report.id}';
      final prefs = await SharedPreferences.getInstance();
      final lastSentAt = prefs.getInt(storageKey) ?? 0;
      final remainingMs =
          _sightingDelay.inMilliseconds -
          (DateTime.now().millisecondsSinceEpoch - lastSentAt);

      if (remainingMs > 0) {
        final seconds = (remainingMs / 1000).ceil();
        throw ApiException(
          'Espera $seconds segundos antes de enviar otro Lo vi.',
        );
      }

      final comment = _buildSightingComment();
      final photoUrl = await _uploadSightingPhoto();
      await widget.api.createSighting(report.id, {
        'lat': double.parse(_latitudeController.text.trim()),
        'lng': double.parse(_longitudeController.text.trim()),
        'comment': comment.isEmpty ? null : comment,
        'photo_url': photoUrl,
        'contact_name': _contactController.text.trim().isEmpty
            ? null
            : _contactController.text.trim(),
        'trust_score': _sightingTrustScore,
      });
      await prefs.setInt(storageKey, DateTime.now().millisecondsSinceEpoch);
      _zoneController.clear();
      _seenAtController.clear();
      _commentController.clear();
      _contactController.clear();
      _sightingPhotoBytes = null;
      _sightingPhotoName = null;
      setState(() {
        _sightingMessage = 'Lo vi enviado. Gracias por ayudar.';
        _detailFuture = _loadDetail();
      });
    } catch (error) {
      setState(() => _sightingMessage = 'Error: $error');
    } finally {
      if (mounted) {
        setState(() => _submittingSighting = false);
      }
    }
  }

  int get _sightingTrustScore {
    final hasPhoto = _sightingPhotoBytes != null;
    final hasComment = _commentController.text.trim().isNotEmpty;
    final hasContact = _contactController.text.trim().isNotEmpty;
    final score =
        35 +
        (hasPhoto ? 25 : 0) +
        (hasComment ? 15 : 0) +
        (hasContact ? 10 : 0);
    return score > 100 ? 100 : score;
  }

  Future<String?> _uploadSightingPhoto() async {
    final photoBytes = _sightingPhotoBytes;
    if (photoBytes == null) {
      return null;
    }

    final uploaded = await widget.api.uploadPetPhoto(
      bytes: photoBytes,
      filename: _sightingPhotoName ?? 'sighting-photo.webp',
    );
    return uploaded.publicUrl;
  }

  Future<void> _pickSightingPhoto() async {
    setState(() {
      _pickingSightingPhoto = true;
      _sightingMessage = null;
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
        _sightingPhotoBytes = Uint8List.fromList(compressed);
        _sightingPhotoName =
            'sighting-${DateTime.now().millisecondsSinceEpoch}.webp';
        _sightingMessage = 'Foto lista para el Lo vi.';
      });
    } catch (error) {
      setState(
        () => _sightingMessage = 'No se pudo seleccionar la foto: $error',
      );
    } finally {
      if (mounted) {
        setState(() => _pickingSightingPhoto = false);
      }
    }
  }

  void _removeSightingPhoto() {
    setState(() {
      _sightingPhotoBytes = null;
      _sightingPhotoName = null;
      _sightingMessage = null;
    });
  }

  Future<void> _useCurrentSightingLocation() async {
    setState(() {
      _locatingSighting = true;
      _sightingMessage = null;
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
        _latitudeController.text = position.latitude.toStringAsFixed(6);
        _longitudeController.text = position.longitude.toStringAsFixed(6);
        _sightingMessage = 'Ubicacion actual aplicada.';
      });
    } catch (error) {
      setState(() => _sightingMessage = 'No se pudo obtener ubicacion: $error');
    } finally {
      if (mounted) {
        setState(() => _locatingSighting = false);
      }
    }
  }

  String _buildSightingComment() {
    final parts = <String>[];
    final zone = _zoneController.text.trim();
    final seenAt = _seenAtController.text.trim();
    final comment = _commentController.text.trim();

    if (zone.isNotEmpty) {
      parts.add('Zona: $zone');
    }
    if (seenAt.isNotEmpty) {
      parts.add('Fecha/hora aproximada: $seenAt');
    }
    if (comment.isNotEmpty) {
      parts.add(comment);
    }

    return parts.join('\n');
  }

  void _share(PetReport report) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Compartir ${report.name} estara disponible pronto.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.initialReport.name)),
      body: FutureBuilder<_PetDetailData>(
        future: _detailFuture,
        builder: (context, snapshot) {
          final data = snapshot.data;
          final report = data?.report ?? widget.initialReport;
          final sightings = data?.sightings ?? <Sighting>[];

          if (snapshot.connectionState != ConnectionState.done &&
              data == null) {
            return const AppLoadingState(
              center: true,
              title: 'Cargando detalle',
              message: 'Buscando la informacion del reporte.',
            );
          }

          if (snapshot.hasError && data == null) {
            return AppMessageState(
              icon: Icons.cloud_off,
              title: friendlyErrorTitle(
                snapshot.error,
                fallback: 'No se pudo cargar el detalle',
              ),
              message: friendlyErrorMessage(snapshot.error),
              center: true,
              accentColor: HuellamiGOColors.coral,
              action: OutlinedButton.icon(
                onPressed: _refresh,
                icon: const Icon(Icons.refresh),
                label: const Text('Reintentar'),
              ),
            );
          }

          final reunited = ReportStatus.isReunited(report.status);

          return HuellamiGOAppBackground(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: scrollScreenPadding(context),
                children: [
                  _ReportSummary(report: report, onShare: () => _share(report)),
                  const SizedBox(height: 14),
                  _LocationSection(report: report),
                  const SizedBox(height: 14),
                  _ContactSection(report: report),
                  const SizedBox(height: 14),
                  _SightingsSection(sightings: sightings),
                  const SizedBox(height: 14),
                  _StorySection(report: report),
                  if (reunited) ...[
                    const SizedBox(height: 14),
                    _ReunionStorySection(report: report),
                  ],
                  if (!reunited) ...[
                    const SizedBox(height: 14),
                    _SightingForm(
                      formKey: _sightingFormKey,
                      zoneController: _zoneController,
                      seenAtController: _seenAtController,
                      commentController: _commentController,
                      contactController: _contactController,
                      latitudeController: _latitudeController,
                      longitudeController: _longitudeController,
                      submitting: _submittingSighting,
                      pickingPhoto: _pickingSightingPhoto,
                      locating: _locatingSighting,
                      photoBytes: _sightingPhotoBytes,
                      message: _sightingMessage,
                      onPickPhoto: _pickSightingPhoto,
                      onRemovePhoto: _removeSightingPhoto,
                      onUseCurrentLocation: _useCurrentSightingLocation,
                      onSubmit: () => _submitSighting(report),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _HeroPhoto extends StatelessWidget {
  const _HeroPhoto({required this.report});

  final PetReport report;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: AspectRatio(
        aspectRatio: 4 / 3,
        child: Container(
          color: HuellamiGOColors.mint,
          child: CachedAppImage(
            imageUrl: report.photoUrl,
            fit: BoxFit.cover,
            icon: Icons.pets,
            iconSize: 64,
            cacheWidth: 720,
            cacheHeight: 540,
          ),
        ),
      ),
    );
  }
}

class _ReportSummary extends StatelessWidget {
  const _ReportSummary({required this.report, required this.onShare});

  final PetReport report;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return _DetailPanel(
      eyebrow: 'Alerta',
      title: ReportStatus.isReunited(report.status)
          ? '${report.name} volvio a casa'
          : 'Buscamos a ${report.name}',
      icon: ReportStatus.isReunited(report.status)
          ? Icons.favorite
          : Icons.notifications_active,
      children: [
        _HeroPhoto(report: report),
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(report.name, style: theme.textTheme.headlineSmall),
                  const SizedBox(height: 4),
                  Text(
                    '${report.species} - ${report.zone}',
                    style: theme.textTheme.bodyLarge,
                  ),
                ],
              ),
            ),
            IconButton.filledTonal(
              onPressed: onShare,
              icon: const Icon(Icons.ios_share),
              tooltip: 'Compartir',
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _InfoPill(icon: Icons.schedule, label: report.lastSeenWhen),
            _InfoPill(icon: Icons.flag, label: _statusLabel(report.status)),
            _InfoPill(
              icon: Icons.timeline,
              label: _lifeStageLabel(report.lifeStage),
            ),
            if (report.isVulnerable)
              const _InfoPill(
                icon: Icons.health_and_safety,
                label: 'Condicion vulnerable',
              ),
            if (report.isUrgent)
              const _InfoPill(
                icon: Icons.priority_high,
                label: 'Herida o riesgo',
              ),
            if (report.needsMedication)
              const _InfoPill(
                icon: Icons.medical_services,
                label: 'Cuidados especiales',
              ),
            if (report.reward.enabled)
              _InfoPill(icon: Icons.paid, label: _rewardLabel(report)),
          ],
        ),
      ],
    );
  }

  String _rewardLabel(PetReport report) {
    final amount = report.reward.amount;
    if (report.reward.showAmount && amount != null) {
      return '\$${amount.toStringAsFixed(amount.truncateToDouble() == amount ? 0 : 2)} ${report.reward.currency}';
    }
    return 'Recompensa disponible';
  }

  String _lifeStageLabel(String lifeStage) {
    return switch (lifeStage) {
      'puppy' => 'Cachorro',
      'senior' => 'Adulto mayor',
      _ => 'Adulto',
    };
  }

  String _statusLabel(String status) {
    return switch (status) {
      'reunited' => 'Reunido',
      'archived' => 'Archivado',
      _ => 'Activo',
    };
  }
}

class _LocationSection extends StatelessWidget {
  const _LocationSection({required this.report});

  final PetReport report;

  @override
  Widget build(BuildContext context) {
    return _DetailPanel(
      eyebrow: 'Ubicacion',
      title: 'Ultima zona conocida',
      icon: Icons.place,
      children: [
        _DetailRow(icon: Icons.map_outlined, label: 'Zona', value: report.zone),
        const SizedBox(height: 10),
        _DetailRow(
          icon: Icons.schedule,
          label: 'Visto por ultima vez',
          value: report.lastSeenWhen,
        ),
        const SizedBox(height: 10),
        _DetailRow(
          icon: Icons.my_location,
          label: 'Coordenadas aproximadas',
          value:
              '${report.latitude?.toStringAsFixed(5) ?? '-'}, ${report.longitude?.toStringAsFixed(5) ?? '-'}',
        ),
      ],
    );
  }
}

class _StorySection extends StatelessWidget {
  const _StorySection({required this.report});

  final PetReport report;

  @override
  Widget build(BuildContext context) {
    return _DetailPanel(
      eyebrow: 'Historia',
      title: 'Detalles del reporte',
      icon: Icons.notes,
      children: [
        Text(report.description, style: Theme.of(context).textTheme.bodyLarge),
      ],
    );
  }
}

class _DetailPanel extends StatelessWidget {
  const _DetailPanel({
    required this.eyebrow,
    required this.title,
    required this.children,
    required this.icon,
    this.tint,
  });

  final String eyebrow;
  final String title;
  final List<Widget> children;
  final IconData icon;
  final Color? tint;

  @override
  Widget build(BuildContext context) {
    final accent = tint ?? HuellamiGOColors.forest;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: HuellamiGOColors.paper,
        border: Border.all(color: HuellamiGOColors.line),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: HuellamiGOColors.forest.withValues(alpha: 0.06),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: accent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppEyebrow(eyebrow),
                    const SizedBox(height: 2),
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 19, color: HuellamiGOColors.forest),
        const SizedBox(width: 9),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: HuellamiGOColors.forest,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(value),
            ],
          ),
        ),
      ],
    );
  }
}

class _ContactSection extends StatelessWidget {
  const _ContactSection({required this.report});

  final PetReport report;

  @override
  Widget build(BuildContext context) {
    final contact = report.contact;
    final whatsappUrl = contact.whatsappUrl;

    return _DetailPanel(
      eyebrow: 'Contacto',
      title: 'Como ayudar',
      icon: Icons.contact_phone,
      children: [
        _DetailRow(
          icon: Icons.person_outline,
          label: 'Persona de contacto',
          value: contact.name,
        ),
        const SizedBox(height: 10),
        _DetailRow(
          icon: Icons.chat_bubble_outline,
          label: 'Metodo preferido',
          value: contact.preferredMethod,
        ),
        const SizedBox(height: 10),
        _DetailRow(
          icon: Icons.lock_outline,
          label: 'Dato visible',
          value: contact.masked,
        ),
        if (whatsappUrl != null) ...[
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => _openWhatsapp(context, whatsappUrl),
              icon: const Icon(Icons.chat_bubble_outline),
              label: const Text('Contactar por WhatsApp'),
            ),
          ),
        ],
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: HuellamiGOColors.mint,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: HuellamiGOColors.line),
          ),
          child: const Row(
            children: [
              Icon(
                Icons.privacy_tip_outlined,
                size: 18,
                color: HuellamiGOColors.forest,
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Evita publicar datos sensibles. HuellamiGO protege el contacto cuando no es publico.',
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _openWhatsapp(BuildContext context, String url) async {
    final messenger = ScaffoldMessenger.of(context);
    final uri = Uri.tryParse(url);

    if (uri == null) {
      messenger.showSnackBar(
        const SnackBar(content: Text('No se pudo abrir WhatsApp.')),
      );
      return;
    }

    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);

    if (!opened) {
      messenger.showSnackBar(
        const SnackBar(content: Text('No se pudo abrir WhatsApp.')),
      );
    }
  }
}

class _ReunionStorySection extends StatelessWidget {
  const _ReunionStorySection({required this.report});

  final PetReport report;

  @override
  Widget build(BuildContext context) {
    final photos = [
      report.reunionStory.photoUrl,
      report.reunionStory.photoUrl2,
    ].whereType<String>().toList();

    return _DetailPanel(
      eyebrow: 'Reencuentro',
      title: '${report.name} volvio a casa',
      icon: Icons.favorite,
      tint: HuellamiGOColors.sage,
      children: [
        Text(
          report.reunionStory.message ??
              'Una familia compartio su final feliz con la comunidad.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        if (photos.isNotEmpty) ...[
          const SizedBox(height: 12),
          SizedBox(
            height: 138,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: photos.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                return ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: CachedAppImage(
                    imageUrl: photos[index],
                    width: 138,
                    height: 138,
                    fit: BoxFit.cover,
                    icon: Icons.favorite,
                    cacheWidth: 138,
                    cacheHeight: 138,
                  ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }
}

class _SightingsSection extends StatelessWidget {
  const _SightingsSection({required this.sightings});

  final List<Sighting> sightings;

  @override
  Widget build(BuildContext context) {
    return _DetailPanel(
      eyebrow: 'Avistamientos',
      title: 'Lo vi recibidos (${sightings.length})',
      icon: Icons.visibility,
      children: [
        if (sightings.isEmpty)
          const Text('Aun no hay Lo vi para este reporte.')
        else
          ...sightings.map((sighting) => _SightingTile(sighting: sighting)),
      ],
    );
  }
}

class _SightingTile extends StatelessWidget {
  const _SightingTile({required this.sighting});

  final Sighting sighting;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: sighting.photoUrl == null
          ? const Icon(Icons.visibility)
          : ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: CachedAppImage(
                imageUrl: sighting.photoUrl,
                width: 44,
                height: 44,
                fit: BoxFit.cover,
                icon: Icons.visibility,
                cacheWidth: 44,
                cacheHeight: 44,
              ),
            ),
      title: Text(
        sighting.comment.isEmpty ? 'Lo vi reportado' : sighting.comment,
      ),
      subtitle: Text(
        '${sighting.status} - ${sighting.latitude?.toStringAsFixed(5) ?? '-'}, ${sighting.longitude?.toStringAsFixed(5) ?? '-'}',
      ),
    );
  }
}

class _SightingForm extends StatelessWidget {
  const _SightingForm({
    required this.formKey,
    required this.zoneController,
    required this.seenAtController,
    required this.commentController,
    required this.contactController,
    required this.latitudeController,
    required this.longitudeController,
    required this.submitting,
    required this.pickingPhoto,
    required this.locating,
    required this.photoBytes,
    required this.onSubmit,
    required this.onPickPhoto,
    required this.onRemovePhoto,
    required this.onUseCurrentLocation,
    this.message,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController zoneController;
  final TextEditingController seenAtController;
  final TextEditingController commentController;
  final TextEditingController contactController;
  final TextEditingController latitudeController;
  final TextEditingController longitudeController;
  final bool submitting;
  final bool pickingPhoto;
  final bool locating;
  final Uint8List? photoBytes;
  final VoidCallback onSubmit;
  final VoidCallback onPickPhoto;
  final VoidCallback onRemovePhoto;
  final VoidCallback onUseCurrentLocation;
  final String? message;

  @override
  Widget build(BuildContext context) {
    return _DetailPanel(
      eyebrow: 'Lo vi',
      title: 'Reportar avistamiento',
      icon: Icons.add_location_alt,
      children: [
        Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Marca una zona aproximada, agrega una pista corta y una foto si puedes hacerlo sin acercarte.',
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: zoneController,
                decoration: const InputDecoration(
                  labelText: 'Zona o ubicacion aproximada',
                  hintText: 'Calle, colonia, parque...',
                  border: OutlineInputBorder(),
                ),
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'Agrega una zona aproximada'
                    : null,
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: seenAtController,
                decoration: const InputDecoration(
                  labelText: 'Fecha/hora aproximada',
                  hintText: 'Hoy 6:30 PM, ayer por la tarde...',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: commentController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Comentario opcional',
                  hintText:
                      'Ej. Iba caminando hacia la avenida, parecia asustada.',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: contactController,
                decoration: const InputDecoration(
                  labelText: 'Tu nombre opcional',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              _SightingPhotoPicker(
                photoBytes: photoBytes,
                picking: pickingPhoto,
                onPick: onPickPhoto,
                onRemove: onRemovePhoto,
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton.icon(
                  onPressed: locating ? null : onUseCurrentLocation,
                  icon: locating
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.my_location),
                  label: const Text('Usar mi ubicacion'),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: latitudeController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                        signed: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Latitud',
                        border: OutlineInputBorder(),
                      ),
                      validator: _validNumber,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: longitudeController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                        signed: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Longitud',
                        border: OutlineInputBorder(),
                      ),
                      validator: _validNumber,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: submitting ? null : onSubmit,
                icon: submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check_circle_outline),
                label: const Text('Enviar Lo vi'),
              ),
              if (message != null) ...[
                const SizedBox(height: 10),
                Text(message!),
              ],
            ],
          ),
        ),
      ],
    );
  }

  String? _validNumber(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Requerido';
    }
    return double.tryParse(value.trim()) == null ? 'Numero invalido' : null;
  }
}

class _SightingPhotoPicker extends StatelessWidget {
  const _SightingPhotoPicker({
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
    final colors = Theme.of(context).colorScheme;
    final bytes = photoBytes;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: bytes == null
          ? OutlinedButton.icon(
              onPressed: picking ? null : onPick,
              icon: picking
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.camera_alt_outlined),
              label: const Text('Foto opcional'),
            )
          : Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.memory(
                    bytes,
                    width: 64,
                    height: 64,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Foto del Lo vi lista',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                IconButton(
                  onPressed: onRemove,
                  icon: const Icon(Icons.delete_outline),
                  tooltip: 'Quitar foto',
                ),
              ],
            ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: colors.primary),
          const SizedBox(width: 5),
          Text(label),
        ],
      ),
    );
  }
}

class _PetDetailData {
  const _PetDetailData({required this.report, required this.sightings});

  final PetReport report;
  final List<Sighting> sightings;
}
