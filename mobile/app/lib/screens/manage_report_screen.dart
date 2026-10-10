import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart' show LatLng;

import '../api/api_client.dart';
import '../models/managed_sighting_map_item.dart';
import '../models/pet_report.dart';
import '../models/report_status.dart';
import '../models/reviewed_search_zone.dart';
import '../models/sighting.dart';
import '../widgets/app_feedback.dart';
import '../widgets/huellamigo_ui.dart';
import '../widgets/pet_widgets.dart';
import '../widgets/screen_padding.dart';

class ManageReportScreen extends StatefulWidget {
  const ManageReportScreen({
    super.key,
    required this.api,
    required this.initialReport,
  });

  final ApiClient api;
  final PetReport initialReport;

  @override
  State<ManageReportScreen> createState() => _ManageReportScreenState();
}

class _ManageReportScreenState extends State<ManageReportScreen> {
  static const _maxReunionPhotos = 2;

  final _storyController = TextEditingController();
  final List<_ReunionPhotoDraft> _reunionPhotos = <_ReunionPhotoDraft>[];
  late Future<_ManagedReportData> _dataFuture;
  bool _publicAllowed = false;
  bool _pickingReunionPhoto = false;
  bool _saving = false;
  String? _message;

  String? get _token => widget.initialReport.manageToken;

  @override
  void initState() {
    super.initState();
    _storyController.text = widget.initialReport.reunionStory.message ?? '';
    _publicAllowed = widget.initialReport.reunionStory.publicAllowed;
    _dataFuture = _loadData();
  }

  @override
  void dispose() {
    _storyController.dispose();
    super.dispose();
  }

  Future<_ManagedReportData> _loadData() async {
    final token = _token;
    if (token == null || token.isEmpty) {
      throw const ApiException('Este reporte no tiene token de gestion.');
    }

    final report = await widget.api.getManagedReport(
      widget.initialReport.id,
      token,
    );
    final sightings = await widget.api.getManagedSightings(report.id, token);

    return _ManagedReportData(report: report, sightings: sightings);
  }

  void _refreshData() {
    setState(() => _dataFuture = _loadData());
  }

  Future<void> _pickReunionPhoto() async {
    if (_reunionPhotos.length >= _maxReunionPhotos) {
      setState(
        () => _message = 'Puedes subir maximo $_maxReunionPhotos fotos.',
      );
      return;
    }

    setState(() {
      _pickingReunionPhoto = true;
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

      if (!mounted) {
        return;
      }

      setState(() {
        _reunionPhotos.add(
          _ReunionPhotoDraft(
            bytes: Uint8List.fromList(compressed),
            filename:
                '${DateTime.now().millisecondsSinceEpoch}-reencuentro.webp',
          ),
        );
        _publicAllowed = true;
        _message = 'Foto lista para la historia.';
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _message = error.message);
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _message = 'No se pudo preparar la foto.');
    } finally {
      if (mounted) {
        setState(() => _pickingReunionPhoto = false);
      }
    }
  }

  void _removeReunionPhoto(_ReunionPhotoDraft photo) {
    setState(() {
      _reunionPhotos.remove(photo);
      _message = null;
    });
  }

  Future<List<String>> _uploadReunionPhotos() async {
    final uploadedUrls = <String>[];

    for (final photo in _reunionPhotos) {
      final uploaded = await widget.api.uploadPetPhoto(
        bytes: photo.bytes,
        filename: photo.filename,
      );
      uploadedUrls.add(uploaded.publicUrl);
    }

    return uploadedUrls;
  }

  Future<void> _updateStatus(String status, {PetReport? currentReport}) async {
    final token = _token;
    if (token == null || token.isEmpty) {
      setState(() => _message = 'No hay token de gestion para este reporte.');
      return;
    }

    final storyMessage = _storyController.text.trim();
    if (status == ReportStatus.reunited && storyMessage.length > 180) {
      setState(
        () => _message = 'La historia debe tener maximo 180 caracteres.',
      );
      return;
    }

    setState(() {
      _saving = true;
      _message = null;
    });

    try {
      final uploadedPhotoUrls = status == ReportStatus.reunited
          ? await _uploadReunionPhotos()
          : const <String>[];
      final existingStory = currentReport?.reunionStory;
      final hasNewPhotos = uploadedPhotoUrls.isNotEmpty;
      String? reunionPhotoUrl;
      String? reunionPhotoUrl2;

      if (hasNewPhotos) {
        reunionPhotoUrl = uploadedPhotoUrls[0];
        reunionPhotoUrl2 = uploadedPhotoUrls.length > 1
            ? uploadedPhotoUrls[1]
            : null;
      } else {
        reunionPhotoUrl = existingStory?.photoUrl;
        reunionPhotoUrl2 = existingStory?.photoUrl2;
      }

      await widget.api.updateManagedReportStatus(
        id: widget.initialReport.id,
        token: token,
        status: status,
        reunionStory: status == ReportStatus.reunited
            ? {
                'message': storyMessage.isEmpty ? null : storyMessage,
                'photoUrl': reunionPhotoUrl,
                'photoUrl2': reunionPhotoUrl2,
                'publicAllowed': _publicAllowed,
              }
            : const <String, dynamic>{},
      );

      if (!mounted) {
        return;
      }

      if (status == ReportStatus.archived) {
        Navigator.of(context).pop(true);
        return;
      }

      setState(() {
        _saving = false;
        _message = status == ReportStatus.reunited
            ? 'Reporte marcado como reunido.'
            : 'Reporte actualizado.';
        if (status == ReportStatus.reunited) {
          _reunionPhotos.clear();
        }
        _dataFuture = _loadData();
      });
    } on ApiException catch (error) {
      setState(() {
        _saving = false;
        _message = error.message;
      });
    } catch (error) {
      setState(() {
        _saving = false;
        _message = 'No se pudo actualizar: $error';
      });
    }
  }

  Future<void> _updateSighting(
    Sighting sighting,
    String status,
    bool useful,
    bool trailKey,
    String successMessage,
  ) async {
    final token = _token;
    if (token == null || token.isEmpty) {
      setState(() => _message = 'No hay token de gestion para este reporte.');
      return;
    }

    setState(() {
      _saving = true;
      _message = null;
    });

    try {
      await widget.api.updateManagedSighting(
        reportId: widget.initialReport.id,
        token: token,
        sightingId: sighting.id,
        status: status,
        isUseful: useful,
        isTrailKey: trailKey,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _saving = false;
        _message = successMessage;
        _dataFuture = _loadData();
      });
    } on ApiException catch (error) {
      setState(() {
        _saving = false;
        _message = error.message;
      });
    } catch (error) {
      setState(() {
        _saving = false;
        _message = 'No se pudo actualizar el Lo vi: $error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Gestion privada')),
      body: FutureBuilder<_ManagedReportData>(
        future: _dataFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const AppLoadingState(
              center: true,
              title: 'Cargando gestion',
              message: 'Preparando el reporte privado.',
            );
          }

          if (snapshot.hasError) {
            return AppMessageState(
              icon: Icons.lock_outline,
              title: friendlyErrorTitle(
                snapshot.error,
                fallback: 'No se pudo abrir gestion',
              ),
              message: friendlyErrorMessage(snapshot.error),
              center: true,
              accentColor: HuellamiGOColors.coral,
              action: OutlinedButton.icon(
                onPressed: _refreshData,
                icon: const Icon(Icons.refresh),
                label: const Text('Reintentar'),
              ),
            );
          }

          final data = snapshot.data!;

          return ListView(
            padding: scrollScreenPadding(context),
            children: [
              _ReportManageSummary(report: data.report),
              const SizedBox(height: 16),
              _StatusActions(
                report: data.report,
                saving: _saving,
                storyController: _storyController,
                publicAllowed: _publicAllowed,
                onPublicAllowedChanged: (value) =>
                    setState(() => _publicAllowed = value),
                reunionPhotos: _reunionPhotos,
                pickingReunionPhoto: _pickingReunionPhoto,
                onPickReunionPhoto: _pickReunionPhoto,
                onRemoveReunionPhoto: _removeReunionPhoto,
                onMarkReunited: () => _updateStatus(
                  ReportStatus.reunited,
                  currentReport: data.report,
                ),
                onArchive: () => _confirmArchive(context),
              ),
              if (_message != null) ...[
                const SizedBox(height: 12),
                _ManageSuccessMessage(message: _message!),
              ],
              const SizedBox(height: 16),
              _SearchTrailSummary(sightings: data.sightings),
              const SizedBox(height: 16),
              _PrivateSearchMapSection(
                api: widget.api,
                report: data.report,
                token: _token!,
                sightings: data.sightings,
              ),
              const SizedBox(height: 16),
              _PrivateSightingsSection(
                sightings: data.sightings,
                saving: _saving,
                onTrailKey: (sighting) => _updateSighting(
                  sighting,
                  'visible',
                  true,
                  true,
                  'Lo vi marcado como pista clave.',
                ),
                onUseful: (sighting) => _updateSighting(
                  sighting,
                  'visible',
                  true,
                  false,
                  'Lo vi marcado como util.',
                ),
                onHide: (sighting) => _updateSighting(
                  sighting,
                  ReportStatus.hidden,
                  false,
                  false,
                  'Lo vi marcado como no util para el rastro.',
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _confirmArchive(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ocultar reporte'),
        content: const Text(
          'El reporte dejara de aparecer publicamente y el link privado se revocara.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Ocultar'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _updateStatus(ReportStatus.archived);
    }
  }
}

class _ReunionPhotoDraft {
  const _ReunionPhotoDraft({required this.bytes, required this.filename});

  final Uint8List bytes;
  final String filename;
}

class _ReportManageSummary extends StatelessWidget {
  const _ReportManageSummary({required this.report});

  final PetReport report;

  @override
  Widget build(BuildContext context) {
    return _PrivateManageCard(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 72),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _FramedPetPhoto(imageUrl: report.photoUrl),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Link privado',
                              style: TextStyle(
                                color: HuellamiGOColors.forest,
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              report.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: HuellamiGOColors.coral,
                                fontFamily: HuellamiGOFonts.title,
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                                height: 1.02,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(
                                  Icons.place,
                                  size: 15,
                                  color: HuellamiGOColors.sage,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    '${report.species} - ${report.zone}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodySmall,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: [
                                _ManagePill(
                                  icon: Icons.flag,
                                  label: report.status,
                                ),
                                _ManagePill(
                                  icon: Icons.visibility,
                                  label: '${report.sightingsCount} avist.',
                                  tone: _PillTone.coral,
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Transform.translate(
                  offset: const Offset(3, 0),
                  child: _DashedBox(
                    minHeight: 46,
                    child: Row(
                      children: [
                        const Icon(
                          Icons.pets,
                          size: 18,
                          color: HuellamiGOColors.coral,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            report.description.isEmpty
                                ? 'Sin descripcion.'
                                : report.description,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            right: -8, //0
            bottom: -11, //0
            child: Image.asset(
              HuellamiGOAssets.privateReportPresentation,
              width: 78,
              height: 78,
              fit: BoxFit.contain,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusActions extends StatelessWidget {
  const _StatusActions({
    required this.report,
    required this.saving,
    required this.storyController,
    required this.publicAllowed,
    required this.onPublicAllowedChanged,
    required this.reunionPhotos,
    required this.pickingReunionPhoto,
    required this.onPickReunionPhoto,
    required this.onRemoveReunionPhoto,
    required this.onMarkReunited,
    required this.onArchive,
  });

  final PetReport report;
  final bool saving;
  final TextEditingController storyController;
  final bool publicAllowed;
  final ValueChanged<bool> onPublicAllowedChanged;
  final List<_ReunionPhotoDraft> reunionPhotos;
  final bool pickingReunionPhoto;
  final VoidCallback onPickReunionPhoto;
  final ValueChanged<_ReunionPhotoDraft> onRemoveReunionPhoto;
  final VoidCallback onMarkReunited;
  final VoidCallback onArchive;

  @override
  Widget build(BuildContext context) {
    return _PrivateManageCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              _StatusHeaderIcon(),
              SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Cerrar o archivar',
                      style: TextStyle(
                        color: HuellamiGOColors.graphite,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Puedes cerrar el reporte si ya no esta activo.',
                      style: TextStyle(fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _StoryField(controller: storyController),
          Align(
            alignment: Alignment.centerRight,
            child: ValueListenableBuilder<TextEditingValue>(
              valueListenable: storyController,
              builder: (context, value, child) {
                return Text(
                  '${value.text.length}/180',
                  style: Theme.of(context).textTheme.bodySmall,
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          _ReunionPhotoPicker(
            photos: reunionPhotos,
            saving: saving,
            picking: pickingReunionPhoto,
            onPickPhoto: onPickReunionPhoto,
            onRemovePhoto: onRemoveReunionPhoto,
          ),
          const SizedBox(height: 8),
          _PublicStoryToggle(
            value: publicAllowed,
            saving: saving,
            onChanged: onPublicAllowedChanged,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: saving ? null : onMarkReunited,
                  icon: const Icon(Icons.check_circle_outline, size: 18),
                  label: const Text(
                    'Marcar como reunida',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: saving ? null : onArchive,
                  icon: const Icon(Icons.visibility_off_outlined, size: 18),
                  label: const Text(
                    'Ocultar reporte',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
          if (report.reunionStory.message != null) ...[
            const SizedBox(height: 12),
            Text(
              'Historia actual: ${report.reunionStory.message}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

class _PrivateSearchMapSection extends StatefulWidget {
  const _PrivateSearchMapSection({
    required this.api,
    required this.report,
    required this.token,
    required this.sightings,
  });

  final ApiClient api;
  final PetReport report;
  final String token;
  final List<Sighting> sightings;

  @override
  State<_PrivateSearchMapSection> createState() =>
      _PrivateSearchMapSectionState();
}

class _PrivateSearchMapSectionState extends State<_PrivateSearchMapSection> {
  final _mapController = MapController();
  final _reviewNoteController = TextEditingController();
  Timer? _viewportDebounce;
  List<ManagedSightingMapItem> _items = const <ManagedSightingMapItem>[];
  List<ReviewedSearchZone> _reviewedZones = const <ReviewedSearchZone>[];
  ManagedSightingMapItem? _selectedItem;
  ReviewedSearchZone? _selectedZone;
  Sighting? _draftZoneSighting;
  DateTime _draftCheckedAt = DateTime.now();
  bool _loading = true;
  bool _reviewedZonesLoading = true;
  bool _reviewActionSaving = false;
  String? _reviewMessage;
  Object? _error;
  Object? _reviewedZonesError;
  bool _showTrailKey = true;
  bool _showUseful = true;
  bool _showPending = false;
  bool _showHidden = false;
  bool _showReviewedZonesPanel = false;
  bool _mapReady = false;

  @override
  void initState() {
    super.initState();
    _loadInitialMap();
    _loadReviewedZones();
  }

  @override
  void dispose() {
    _viewportDebounce?.cancel();
    _reviewNoteController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _PrivateSearchMapSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.sightings != widget.sightings) {
      _loadCurrentViewport();
    }
  }

  Future<void> _loadInitialMap() async {
    final center = _initialCenter;
    await _loadMapItems(<double>[
      center.longitude - 0.08,
      center.latitude - 0.08,
      center.longitude + 0.08,
      center.latitude + 0.08,
    ], 14);
  }

  Future<void> _loadMapItems(List<double> bbox, double zoom) async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final items = await widget.api.getManagedSightingMap(
        widget.report.id,
        widget.token,
        bbox: bbox,
        zoom: zoom,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _items = items;
        _selectedItem = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = error;
      });
    }
  }

  Future<void> _loadReviewedZones() async {
    setState(() {
      _reviewedZonesLoading = true;
      _reviewedZonesError = null;
    });

    try {
      final zones = await widget.api.getReviewedSearchZones(
        widget.report.id,
        widget.token,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _reviewedZones = zones;
        _reviewedZonesLoading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _reviewedZones = const <ReviewedSearchZone>[];
        _reviewedZonesError = error;
        _reviewedZonesLoading = false;
      });
    }
  }

  void _startReviewZoneDraft(Sighting sighting) {
    if (sighting.latitude == null || sighting.longitude == null) {
      return;
    }

    setState(() {
      _draftZoneSighting = sighting;
      _selectedItem = null;
      _selectedZone = null;
      _draftCheckedAt = DateTime.now();
      _showReviewedZonesPanel = true;
      _reviewMessage = null;
      _reviewNoteController.clear();
    });

    _mapController.move(LatLng(sighting.latitude!, sighting.longitude!), 15);
  }

  void _cancelReviewZoneDraft() {
    setState(() {
      _draftZoneSighting = null;
      _reviewMessage = null;
      _reviewNoteController.clear();
    });
  }

  Future<void> _saveReviewZone() async {
    final sighting = _draftZoneSighting;
    if (sighting == null ||
        sighting.latitude == null ||
        sighting.longitude == null) {
      return;
    }

    setState(() {
      _reviewActionSaving = true;
      _reviewMessage = null;
    });

    try {
      final zone = await widget.api.createReviewedSearchZone(
        reportId: widget.report.id,
        token: widget.token,
        latitude: sighting.latitude!,
        longitude: sighting.longitude!,
        note: _reviewNoteController.text.trim(),
        checkedAt: _draftCheckedAt,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _reviewedZones = [zone, ..._reviewedZones];
        _draftZoneSighting = null;
        _reviewActionSaving = false;
        _reviewMessage = 'Zona marcada como revisada.';
        _reviewNoteController.clear();
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _reviewActionSaving = false;
        _reviewMessage = friendlyErrorMessage(error);
      });
    }
  }

  Future<void> _deleteReviewZone(ReviewedSearchZone zone) async {
    setState(() {
      _reviewActionSaving = true;
      _reviewMessage = null;
    });

    try {
      await widget.api.deleteReviewedSearchZone(
        reportId: widget.report.id,
        token: widget.token,
        zoneId: zone.id,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _reviewedZones = _reviewedZones
            .where((currentZone) => currentZone.id != zone.id)
            .toList();
        if (_selectedZone?.id == zone.id) {
          _selectedZone = null;
        }
        _reviewActionSaving = false;
        _reviewMessage = 'Zona revisada eliminada.';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _reviewActionSaving = false;
        _reviewMessage = friendlyErrorMessage(error);
      });
    }
  }

  Future<void> _pickReviewDateTime() async {
    final current = _draftCheckedAt;
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
    );
    if (pickedDate == null || !mounted) {
      return;
    }

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(current),
    );
    if (pickedTime == null || !mounted) {
      return;
    }

    setState(() {
      _draftCheckedAt = DateTime(
        pickedDate.year,
        pickedDate.month,
        pickedDate.day,
        pickedTime.hour,
        pickedTime.minute,
      );
    });
  }

  void _scheduleViewportLoad() {
    _viewportDebounce?.cancel();
    _viewportDebounce = Timer(
      const Duration(milliseconds: 260),
      _loadCurrentViewport,
    );
  }

  void _loadCurrentViewport() {
    if (!mounted || !_mapReady) {
      return;
    }
    final camera = _mapController.camera;
    final bounds = camera.visibleBounds;
    _loadMapItems(<double>[
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north,
    ], camera.zoom);
  }

  LatLng get _initialCenter {
    final reportLat = widget.report.latitude;
    final reportLng = widget.report.longitude;
    if (reportLat != null && reportLng != null) {
      return LatLng(reportLat, reportLng);
    }

    for (final sighting in widget.sightings) {
      if (sighting.latitude != null && sighting.longitude != null) {
        return LatLng(sighting.latitude!, sighting.longitude!);
      }
    }

    return const LatLng(19.41273, -99.16988);
  }

  List<ManagedSightingMapItem> get _visibleItems {
    return _items.where((item) {
      if (item.isCluster) {
        return _clusterMatchesFilters(item);
      }

      final sighting = item.sighting;
      if (sighting == null) {
        return false;
      }

      if (sighting.isHidden) {
        return _showHidden;
      }

      if (sighting.isTrailKey) {
        return _showTrailKey;
      }

      if (sighting.isUseful) {
        return _showUseful;
      }

      if (sighting.status == 'pending') {
        return _showPending;
      }

      return _showPending;
    }).toList();
  }

  bool _clusterMatchesFilters(ManagedSightingMapItem item) {
    final trailKeyCount = item.trailKeyCount ?? 0;
    final usefulCount = item.usefulCount ?? 0;
    final pendingCount = item.pendingCount ?? 0;
    final hiddenCount = item.hiddenCount ?? 0;
    final normalCount =
        (item.count ?? 0) - usefulCount - pendingCount - hiddenCount;

    return (_showTrailKey && trailKeyCount > 0) ||
        (_showUseful && usefulCount > trailKeyCount) ||
        (_showPending && pendingCount > 0) ||
        (_showHidden && hiddenCount > 0) ||
        (_showPending && normalCount > 0);
  }

  List<LatLng> get _trailPositions {
    final sightings = widget.sightings
        .where(
          (sighting) =>
              sighting.isTrailKey &&
              !sighting.isHidden &&
              sighting.latitude != null &&
              sighting.longitude != null,
        )
        .toList();

    sightings.sort((left, right) {
      final leftTime =
          DateTime.tryParse(left.seenAt ?? left.createdAt ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0);
      final rightTime =
          DateTime.tryParse(right.seenAt ?? right.createdAt ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0);
      return leftTime.compareTo(rightTime);
    });

    return sightings
        .map((sighting) => LatLng(sighting.latitude!, sighting.longitude!))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final reportPosition = _initialCenter;
    final visibleItems = _visibleItems;
    final trailPositions = _trailPositions;
    final draftZonePosition = _draftZonePosition;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const _SectionTitleIcon(icon: Icons.map_outlined),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'Rastro temporal',
                style: TextStyle(
                  color: HuellamiGOColors.forest,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            IconButton(
              onPressed: _loadCurrentViewport,
              icon: const Icon(Icons.refresh),
              tooltip: 'Actualizar mapa',
            ),
          ],
        ),
        const SizedBox(height: 10),
        _PrivateMapFilterBar(
          showTrailKey: _showTrailKey,
          showUseful: _showUseful,
          showPending: _showPending,
          showHidden: _showHidden,
          onTrailKeyChanged: (value) => setState(() => _showTrailKey = value),
          onUsefulChanged: (value) => setState(() => _showUseful = value),
          onPendingChanged: (value) => setState(() => _showPending = value),
          onHiddenChanged: (value) => setState(() => _showHidden = value),
        ),
        const SizedBox(height: 10),
        _PrivateManageCard(
          padding: EdgeInsets.zero,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: SizedBox(
              height: 390,
              child: Stack(
                children: [
                  FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: reportPosition,
                      initialZoom: 14,
                      minZoom: 4,
                      maxZoom: 18,
                      interactionOptions: const InteractionOptions(
                        flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                      ),
                      onMapReady: () {
                        _mapReady = true;
                        _loadCurrentViewport();
                      },
                      onPositionChanged: (_, hasGesture) {
                        if (hasGesture) {
                          _scheduleViewportLoad();
                        }
                      },
                    ),
                    children: [
                      TileLayer(
                        minZoom: 4,
                        maxZoom: 18,
                        maxNativeZoom: 18,
                        urlTemplate:
                            'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                        subdomains: const ['a', 'b', 'c', 'd'],
                        userAgentPackageName: 'com.huellamigo.mobile',
                      ),
                      CircleLayer(
                        circles: [
                          ..._reviewedZones.map(
                            (zone) => CircleMarker(
                              point: LatLng(zone.latitude, zone.longitude),
                              radius: zone.radiusM,
                              useRadiusInMeter: true,
                              color: HuellamiGOColors.sage.withValues(
                                alpha: 0.12,
                              ),
                              borderColor: HuellamiGOColors.sage.withValues(
                                alpha: 0.72,
                              ),
                              borderStrokeWidth: 2,
                            ),
                          ),
                          if (draftZonePosition != null)
                            CircleMarker(
                              point: draftZonePosition,
                              radius: 500,
                              useRadiusInMeter: true,
                              color: HuellamiGOColors.softYellow.withValues(
                                alpha: 0.18,
                              ),
                              borderColor: HuellamiGOColors.forest.withValues(
                                alpha: 0.72,
                              ),
                              borderStrokeWidth: 2,
                            ),
                        ],
                      ),
                      if (trailPositions.length >= 2)
                        PolylineLayer(
                          polylines: [
                            Polyline(
                              points: trailPositions,
                              color: HuellamiGOColors.forest,
                              strokeWidth: 4,
                            ),
                          ],
                        ),
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: reportPosition,
                            width: 48,
                            height: 48,
                            child: const _PrivateReportMapMarker(),
                          ),
                          ..._reviewedZones.map(_reviewedZoneMarker),
                          ...visibleItems.map(_mapMarker),
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
                  if (_loading)
                    const Positioned(
                      left: 12,
                      top: 12,
                      child: _MapStatusPill(
                        icon: Icons.sync,
                        label: 'Actualizando',
                      ),
                    ),
                  if (_error != null)
                    Positioned(
                      left: 12,
                      right: 12,
                      top: 12,
                      child: _MapErrorBanner(
                        message: friendlyErrorMessage(_error),
                        onRetry: _loadCurrentViewport,
                      ),
                    ),
                  if (_selectedItem != null)
                    Positioned(
                      left: 12,
                      right: 12,
                      bottom: 12,
                      child: _SelectedPrivateMapItem(
                        item: _selectedItem!,
                        onClose: () => setState(() => _selectedItem = null),
                        onMarkReviewed: _startReviewZoneDraft,
                      ),
                    ),
                  if (_selectedZone != null)
                    Positioned(
                      left: 12,
                      right: 12,
                      bottom: 12,
                      child: _SelectedReviewedZoneCard(
                        zone: _selectedZone!,
                        saving: _reviewActionSaving,
                        onClose: () => setState(() => _selectedZone = null),
                        onDelete: () => _deleteReviewZone(_selectedZone!),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          visibleItems.where((item) => item.isSighting).isEmpty
              ? 'Mueve o acerca el mapa para ver pistas puntuales.'
              : 'Mostrando ${visibleItems.length} puntos o grupos visibles.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 12),
        _ReviewedZonesPanel(
          zones: _reviewedZones,
          loading: _reviewedZonesLoading,
          saving: _reviewActionSaving,
          expanded: _showReviewedZonesPanel || _draftZoneSighting != null,
          error: _reviewedZonesError,
          message: _reviewMessage,
          draftSighting: _draftZoneSighting,
          checkedAt: _draftCheckedAt,
          noteController: _reviewNoteController,
          onToggle: () => setState(
            () => _showReviewedZonesPanel = !_showReviewedZonesPanel,
          ),
          onPickDateTime: _pickReviewDateTime,
          onSaveDraft: _saveReviewZone,
          onCancelDraft: _cancelReviewZoneDraft,
          onRetry: _loadReviewedZones,
          onFocusZone: _focusReviewZone,
          onDeleteZone: _deleteReviewZone,
        ),
      ],
    );
  }

  LatLng? get _draftZonePosition {
    final sighting = _draftZoneSighting;
    if (sighting == null ||
        sighting.latitude == null ||
        sighting.longitude == null) {
      return null;
    }

    return LatLng(sighting.latitude!, sighting.longitude!);
  }

  Marker _mapMarker(ManagedSightingMapItem item) {
    final point = LatLng(item.latitude, item.longitude);

    if (item.isCluster) {
      final markerSize = _clusterMarkerSize(item.count ?? 0);
      return Marker(
        point: point,
        width: markerSize,
        height: markerSize,
        child: _PrivateClusterMapMarker(
          count: item.count ?? 0,
          usefulCount: item.usefulCount ?? 0,
          trailKeyCount: item.trailKeyCount ?? 0,
          pendingCount: item.pendingCount ?? 0,
          hiddenCount: item.hiddenCount ?? 0,
          onTap: () => _focusCluster(item),
        ),
      );
    }

    final sighting = item.sighting;
    return Marker(
      point: point,
      width: 46,
      height: 46,
      child: _PrivateSightingMapMarker(
        sighting: sighting,
        onTap: () => setState(() => _selectedItem = item),
      ),
    );
  }

  Marker _reviewedZoneMarker(ReviewedSearchZone zone) {
    return Marker(
      point: LatLng(zone.latitude, zone.longitude),
      width: 42,
      height: 42,
      child: _ReviewedZoneMapMarker(
        onTap: () => setState(() {
          _selectedZone = zone;
          _selectedItem = null;
        }),
      ),
    );
  }

  void _focusReviewZone(ReviewedSearchZone zone) {
    setState(() {
      _selectedZone = zone;
      _selectedItem = null;
      _showReviewedZonesPanel = true;
    });

    _mapController.move(LatLng(zone.latitude, zone.longitude), 15);
  }

  void _focusCluster(ManagedSightingMapItem cluster) {
    final bounds = cluster.bounds;
    setState(() => _selectedItem = null);

    if (bounds != null) {
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds(
            LatLng(bounds.south, bounds.west),
            LatLng(bounds.north, bounds.east),
          ),
          maxZoom: 16,
          padding: const EdgeInsets.all(28),
        ),
      );
      _scheduleViewportLoad();
      return;
    }

    _mapController.move(
      LatLng(cluster.latitude, cluster.longitude),
      (_mapController.camera.zoom + 2).clamp(4, 16).toDouble(),
    );
    _scheduleViewportLoad();
  }

  double _clusterMarkerSize(int count) {
    if (count >= 30) {
      return 74;
    }

    if (count >= 12) {
      return 66;
    }

    if (count >= 6) {
      return 60;
    }

    return 54;
  }
}

class _PrivateMapFilterBar extends StatelessWidget {
  const _PrivateMapFilterBar({
    required this.showTrailKey,
    required this.showUseful,
    required this.showPending,
    required this.showHidden,
    required this.onTrailKeyChanged,
    required this.onUsefulChanged,
    required this.onPendingChanged,
    required this.onHiddenChanged,
  });

  final bool showTrailKey;
  final bool showUseful;
  final bool showPending;
  final bool showHidden;
  final ValueChanged<bool> onTrailKeyChanged;
  final ValueChanged<bool> onUsefulChanged;
  final ValueChanged<bool> onPendingChanged;
  final ValueChanged<bool> onHiddenChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _FilterChipButton(
            icon: Icons.star,
            label: 'Clave',
            selected: showTrailKey,
            onTap: () => onTrailKeyChanged(!showTrailKey),
          ),
          _FilterChipButton(
            icon: Icons.check_circle_outline,
            label: 'Util',
            selected: showUseful,
            onTap: () => onUsefulChanged(!showUseful),
          ),
          _FilterChipButton(
            icon: Icons.schedule,
            label: 'Pendiente',
            selected: showPending,
            onTap: () => onPendingChanged(!showPending),
          ),
          _FilterChipButton(
            icon: Icons.visibility_off_outlined,
            label: 'No sirve',
            selected: showHidden,
            onTap: () => onHiddenChanged(!showHidden),
          ),
        ],
      ),
    );
  }
}

class _FilterChipButton extends StatelessWidget {
  const _FilterChipButton({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        avatar: Icon(
          icon,
          size: 16,
          color: selected ? HuellamiGOColors.forest : null,
        ),
        label: Text(
          label,
          style: TextStyle(
            color: selected ? HuellamiGOColors.forest : null,
            fontWeight: selected ? FontWeight.w800 : null,
          ),
        ),
        selected: selected,
        onSelected: (_) => onTap(),
        selectedColor: HuellamiGOColors.softYellow,
        checkmarkColor: HuellamiGOColors.forest,
      ),
    );
  }
}

class _PrivateReportMapMarker extends StatelessWidget {
  const _PrivateReportMapMarker();

  @override
  Widget build(BuildContext context) {
    return const Icon(
      Icons.location_on,
      color: HuellamiGOColors.coral,
      size: 44,
      shadows: [
        Shadow(color: Colors.black38, blurRadius: 8, offset: Offset(0, 3)),
      ],
    );
  }
}

class _PrivateSightingMapMarker extends StatelessWidget {
  const _PrivateSightingMapMarker({
    required this.sighting,
    required this.onTap,
  });

  final Sighting? sighting;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final item = sighting;
    final color = item == null
        ? HuellamiGOColors.forest
        : item.isHidden
        ? Colors.grey
        : item.isTrailKey
        ? HuellamiGOColors.coral
        : item.isUseful
        ? HuellamiGOColors.forest
        : HuellamiGOColors.sage;
    final icon = item?.isTrailKey == true
        ? Icons.star
        : item?.isHidden == true
        ? Icons.close
        : item?.isUseful == true
        ? Icons.check
        : Icons.visibility;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: HuellamiGOColors.paper, width: 3),
          boxShadow: const [
            BoxShadow(
              color: Colors.black26,
              blurRadius: 8,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }
}

class _PrivateClusterMapMarker extends StatelessWidget {
  const _PrivateClusterMapMarker({
    required this.count,
    required this.usefulCount,
    required this.trailKeyCount,
    required this.pendingCount,
    required this.hiddenCount,
    required this.onTap,
  });

  final int count;
  final int usefulCount;
  final int trailKeyCount;
  final int pendingCount;
  final int hiddenCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final highActivity = count >= 12 || trailKeyCount > 0;
    final color = highActivity
        ? HuellamiGOColors.softYellow
        : usefulCount > 0
        ? HuellamiGOColors.forest
        : pendingCount > 0
        ? HuellamiGOColors.sage
        : HuellamiGOColors.navy;
    final foreground = highActivity ? HuellamiGOColors.forest : Colors.white;
    final hiddenOnly = hiddenCount >= count && count > 0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: hiddenOnly ? Colors.grey.shade500 : color,
          shape: BoxShape.circle,
          border: Border.all(color: HuellamiGOColors.paper, width: 3),
          boxShadow: [
            BoxShadow(
              color: highActivity
                  ? HuellamiGOColors.softYellow.withValues(alpha: 0.62)
                  : Colors.black26,
              blurRadius: highActivity ? 16 : 8,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                count > 99 ? '99+' : count.toString(),
                style: TextStyle(
                  color: foreground,
                  fontSize: count >= 30 ? 18 : 16,
                  fontWeight: FontWeight.w900,
                  height: 0.98,
                ),
              ),
              Text(
                'Lo vi',
                style: TextStyle(
                  color: foreground.withValues(alpha: 0.86),
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  height: 1.05,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReviewedZoneMapMarker extends StatelessWidget {
  const _ReviewedZoneMapMarker({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: HuellamiGOColors.paper,
          shape: BoxShape.circle,
          border: Border.all(color: HuellamiGOColors.sage, width: 2),
          boxShadow: const [
            BoxShadow(
              color: Colors.black26,
              blurRadius: 8,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: const Icon(
          Icons.fact_check_outlined,
          color: HuellamiGOColors.forest,
          size: 20,
        ),
      ),
    );
  }
}

class _MapStatusPill extends StatelessWidget {
  const _MapStatusPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: HuellamiGOColors.paper.withValues(alpha: 0.96),
        border: Border.all(color: HuellamiGOColors.line),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: HuellamiGOColors.forest),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                color: HuellamiGOColors.forest,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MapErrorBanner extends StatelessWidget {
  const _MapErrorBanner({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: HuellamiGOColors.paper.withValues(alpha: 0.96),
        border: Border.all(color: HuellamiGOColors.line),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            const Icon(Icons.cloud_off, color: HuellamiGOColors.coral),
            const SizedBox(width: 8),
            Expanded(child: Text(message, maxLines: 2)),
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}

class _SelectedPrivateMapItem extends StatelessWidget {
  const _SelectedPrivateMapItem({
    required this.item,
    required this.onClose,
    required this.onMarkReviewed,
  });

  final ManagedSightingMapItem item;
  final VoidCallback onClose;
  final ValueChanged<Sighting> onMarkReviewed;

  @override
  Widget build(BuildContext context) {
    final sighting = item.sighting;

    if (sighting == null) {
      return _PrivateMapCard(
        icon: Icons.blur_on,
        title: '${item.count ?? 0} pistas en esta zona',
        subtitle:
            '${item.trailKeyCount ?? 0} clave · ${item.usefulCount ?? 0} utiles · ${item.pendingCount ?? 0} pendientes',
        onClose: onClose,
      );
    }

    return _PrivateMapCard(
      icon: sighting.isTrailKey
          ? Icons.star
          : sighting.isHidden
          ? Icons.visibility_off_outlined
          : Icons.visibility,
      title: _mapSightingTitle(sighting),
      subtitle: sighting.comment.isEmpty
          ? _formatSightingDate(sighting.seenAt ?? sighting.createdAt)
          : sighting.comment,
      onClose: onClose,
      action: sighting.canCreateReviewedZone
          ? TextButton.icon(
              onPressed: () => onMarkReviewed(sighting),
              icon: const Icon(Icons.fact_check_outlined),
              label: const Text('Marcar zona revisada'),
            )
          : null,
    );
  }

  String _mapSightingTitle(Sighting sighting) {
    if (sighting.isHidden) {
      return 'No me sirve';
    }
    if (sighting.isTrailKey) {
      return 'Pista clave';
    }
    if (sighting.isUseful) {
      return 'Pista util';
    }
    return sighting.status == 'pending' ? 'Pendiente' : 'Visible';
  }
}

extension _ReviewedZoneSightingRules on Sighting {
  bool get canCreateReviewedZone {
    return !isHidden &&
        (isTrailKey || isUseful) &&
        latitude != null &&
        longitude != null;
  }
}

class _PrivateMapCard extends StatelessWidget {
  const _PrivateMapCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onClose,
    this.action,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onClose;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      color: HuellamiGOColors.paper.withValues(alpha: 0.98),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: HuellamiGOColors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Icon(icon, color: HuellamiGOColors.forest),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      Text(
                        subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: onClose,
                  icon: const Icon(Icons.close),
                  tooltip: 'Cerrar',
                ),
              ],
            ),
            if (action != null) ...[
              const SizedBox(height: 8),
              Align(alignment: Alignment.centerLeft, child: action),
            ],
          ],
        ),
      ),
    );
  }
}

class _SelectedReviewedZoneCard extends StatelessWidget {
  const _SelectedReviewedZoneCard({
    required this.zone,
    required this.saving,
    required this.onClose,
    required this.onDelete,
  });

  final ReviewedSearchZone zone;
  final bool saving;
  final VoidCallback onClose;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return _PrivateMapCard(
      icon: Icons.fact_check_outlined,
      title: zone.note.isEmpty ? 'Zona revisada' : zone.note,
      subtitle:
          '${_formatSightingDate(zone.checkedAt)} · radio ${zone.radiusM.toStringAsFixed(0)} m',
      onClose: onClose,
      action: TextButton.icon(
        onPressed: saving ? null : onDelete,
        icon: const Icon(Icons.delete_outline),
        label: const Text('Eliminar'),
        style: TextButton.styleFrom(foregroundColor: HuellamiGOColors.coral),
      ),
    );
  }
}

class _ReviewedZonesPanel extends StatelessWidget {
  const _ReviewedZonesPanel({
    required this.zones,
    required this.loading,
    required this.saving,
    required this.expanded,
    required this.error,
    required this.message,
    required this.draftSighting,
    required this.checkedAt,
    required this.noteController,
    required this.onToggle,
    required this.onPickDateTime,
    required this.onSaveDraft,
    required this.onCancelDraft,
    required this.onRetry,
    required this.onFocusZone,
    required this.onDeleteZone,
  });

  final List<ReviewedSearchZone> zones;
  final bool loading;
  final bool saving;
  final bool expanded;
  final Object? error;
  final String? message;
  final Sighting? draftSighting;
  final DateTime checkedAt;
  final TextEditingController noteController;
  final VoidCallback onToggle;
  final VoidCallback onPickDateTime;
  final VoidCallback onSaveDraft;
  final VoidCallback onCancelDraft;
  final VoidCallback onRetry;
  final ValueChanged<ReviewedSearchZone> onFocusZone;
  final ValueChanged<ReviewedSearchZone> onDeleteZone;

  @override
  Widget build(BuildContext context) {
    return _PrivateManageCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const _SectionTitleIcon(icon: Icons.fact_check_outlined),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Zonas revisadas',
                  style: TextStyle(
                    color: HuellamiGOColors.forest,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: onToggle,
                icon: Icon(
                  expanded
                      ? Icons.keyboard_arrow_up
                      : Icons.keyboard_arrow_down,
                ),
                label: Text(expanded ? 'Ocultar' : 'Ver ${zones.length}'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Toca una pista util o clave en el mapa para marcar un radio revisado de 500 m.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (expanded) ...[
            const SizedBox(height: 12),
            if (draftSighting != null)
              _ReviewedZoneDraftForm(
                checkedAt: checkedAt,
                noteController: noteController,
                saving: saving,
                onPickDateTime: onPickDateTime,
                onSave: onSaveDraft,
                onCancel: onCancelDraft,
              ),
            if (message != null) ...[
              const SizedBox(height: 10),
              Text(
                message!,
                style: const TextStyle(
                  color: HuellamiGOColors.forest,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
            const SizedBox(height: 10),
            if (loading)
              const Text('Cargando zonas revisadas...')
            else if (error != null)
              Row(
                children: [
                  Expanded(child: Text(friendlyErrorMessage(error))),
                  TextButton(
                    onPressed: onRetry,
                    child: const Text('Reintentar'),
                  ),
                ],
              )
            else if (zones.isEmpty)
              const Text('Aun no hay zonas revisadas.')
            else
              ...zones.map(
                (zone) => _ReviewedZoneListItem(
                  zone: zone,
                  saving: saving,
                  onFocus: () => onFocusZone(zone),
                  onDelete: () => onDeleteZone(zone),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _ReviewedZoneDraftForm extends StatelessWidget {
  const _ReviewedZoneDraftForm({
    required this.checkedAt,
    required this.noteController,
    required this.saving,
    required this.onPickDateTime,
    required this.onSave,
    required this.onCancel,
  });

  final DateTime checkedAt;
  final TextEditingController noteController;
  final bool saving;
  final VoidCallback onPickDateTime;
  final VoidCallback onSave;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: HuellamiGOColors.mint,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Nueva zona revisada',
              style: TextStyle(
                color: HuellamiGOColors.forest,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: noteController,
              maxLength: 96,
              decoration: const InputDecoration(
                labelText: 'Nota privada',
                hintText: 'Ej. Revisado por vecinos',
              ),
            ),
            OutlinedButton.icon(
              onPressed: saving ? null : onPickDateTime,
              icon: const Icon(Icons.event),
              label: Text(_formatSightingDate(checkedAt.toIso8601String())),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: saving ? null : onSave,
                  icon: const Icon(Icons.save_outlined),
                  label: Text(saving ? 'Guardando' : 'Guardar zona'),
                ),
                OutlinedButton(
                  onPressed: saving ? null : onCancel,
                  child: const Text('Cancelar'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ReviewedZoneListItem extends StatelessWidget {
  const _ReviewedZoneListItem({
    required this.zone,
    required this.saving,
    required this.onFocus,
    required this.onDelete,
  });

  final ReviewedSearchZone zone;
  final bool saving;
  final VoidCallback onFocus;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: InkWell(
        onTap: onFocus,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              const Icon(
                Icons.fact_check_outlined,
                color: HuellamiGOColors.forest,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      zone.note.isEmpty ? 'Zona revisada' : zone.note,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(
                      _formatSightingDate(zone.checkedAt),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: saving ? null : onDelete,
                icon: const Icon(Icons.delete_outline),
                color: HuellamiGOColors.coral,
                tooltip: 'Eliminar',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PrivateSightingsSection extends StatelessWidget {
  const _PrivateSightingsSection({
    required this.sightings,
    required this.saving,
    required this.onTrailKey,
    required this.onUseful,
    required this.onHide,
  });

  final List<Sighting> sightings;
  final bool saving;
  final ValueChanged<Sighting> onTrailKey;
  final ValueChanged<Sighting> onUseful;
  final ValueChanged<Sighting> onHide;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const _SectionTitleIcon(icon: Icons.pets),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'Lo vi recibidos',
                style: TextStyle(
                  color: HuellamiGOColors.forest,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: HuellamiGOColors.mint,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '${sightings.length}',
                style: const TextStyle(
                  color: HuellamiGOColors.forest,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (sightings.isEmpty)
          const AppMessageState(
            icon: Icons.visibility_off,
            title: 'Sin Lo vi',
            message: 'Cuando alguien use Lo vi, aparecera aqui.',
          )
        else
          ...sightings.map(
            (sighting) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ManagedSightingCard(
                sighting: sighting,
                saving: saving,
                trailKeyCount: _trailKeyCount,
                onTrailKey: () => onTrailKey(sighting),
                onUseful: () => onUseful(sighting),
                onHide: () => onHide(sighting),
              ),
            ),
          ),
      ],
    );
  }

  int get _trailKeyCount => sightings
      .where((sighting) => sighting.isTrailKey && !sighting.isHidden)
      .length;
}

class _ManagedSightingCard extends StatelessWidget {
  const _ManagedSightingCard({
    required this.sighting,
    required this.saving,
    required this.trailKeyCount,
    required this.onTrailKey,
    required this.onUseful,
    required this.onHide,
  });

  final Sighting sighting;
  final bool saving;
  final int trailKeyCount;
  final VoidCallback onTrailKey;
  final VoidCallback onUseful;
  final VoidCallback onHide;

  static const _maxTrailKeySightings = 5;

  @override
  Widget build(BuildContext context) {
    return _PrivateManageCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SightingAvatar(sighting: sighting),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sighting.contactName ?? 'Vecino de la comunidad',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: HuellamiGOColors.graphite,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        _SightingStatusBadge(
                          label: _sightingLabel(sighting),
                          icon: _statusIcon,
                          tone: _statusTone,
                        ),
                        _SightingStatusBadge(
                          label:
                              'Confianza ${sighting.confidenceLabel} ${sighting.trustScore}/100',
                          icon: Icons.verified_user,
                          tone: HuellamiGOColors.forest,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (_hasPhoto) ...[
            const SizedBox(height: 12),
            _SightingEvidencePreview(sighting: sighting),
          ],
          const SizedBox(height: 12),
          _SightingDetailRows(sighting: sighting),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (!sighting.isHidden)
                _CompactActionButton(
                  icon: Icons.star_outline,
                  label: 'Pista clave',
                  onPressed: saving || !_canMarkTrailKey ? null : onTrailKey,
                ),
              _CompactActionButton(
                icon: Icons.check_circle_outline,
                label: sighting.isUseful ? 'Marcado util' : 'Marcar util',
                onPressed: saving ? null : onUseful,
              ),
              _CompactActionButton(
                icon: Icons.visibility_off_outlined,
                label: 'No me sirve',
                destructive: true,
                onPressed: saving ? null : onHide,
              ),
            ],
          ),
          if (!_canMarkTrailKey && !sighting.isTrailKey && !sighting.isHidden)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Ya tienes 5 pistas clave. Baja una a util para marcar esta.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: HuellamiGOColors.coral,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
    );
  }

  bool get _canMarkTrailKey {
    return sighting.isTrailKey || trailKeyCount < _maxTrailKeySightings;
  }

  bool get _hasPhoto {
    return sighting.photoUrl != null && sighting.photoUrl!.isNotEmpty;
  }

  IconData get _statusIcon {
    if (sighting.isHidden) {
      return Icons.visibility_off_outlined;
    }
    if (sighting.isTrailKey) {
      return Icons.star;
    }
    if (sighting.isUseful) {
      return Icons.check_circle_outline;
    }
    return sighting.status == 'pending' ? Icons.schedule : Icons.visibility;
  }

  Color get _statusTone {
    if (sighting.isHidden) {
      return Colors.grey;
    }
    if (sighting.isTrailKey) {
      return HuellamiGOColors.coral;
    }
    if (sighting.isUseful) {
      return HuellamiGOColors.forest;
    }
    return HuellamiGOColors.sage;
  }

  String _sightingLabel(Sighting sighting) {
    if (sighting.isHidden) {
      return 'No me sirve';
    }
    if (sighting.isTrailKey) {
      return 'Pista clave';
    }
    if (sighting.isUseful) {
      return 'Marcado util';
    }
    return sighting.status == 'pending' ? 'Pendiente' : 'Visible';
  }
}

class _CompactActionButton extends StatelessWidget {
  const _CompactActionButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final foreground = destructive
        ? HuellamiGOColors.coral
        : HuellamiGOColors.forest;

    return OutlinedButton.icon(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(foregroundColor: foreground),
      icon: Icon(icon, size: 18),
      label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
    );
  }
}

class _SightingStatusBadge extends StatelessWidget {
  const _SightingStatusBadge({
    required this.label,
    required this.icon,
    required this.tone,
  });

  final String label;
  final IconData icon;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        border: Border.all(color: tone.withValues(alpha: 0.28)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: tone),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: tone,
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _SightingEvidencePreview extends StatelessWidget {
  const _SightingEvidencePreview({required this.sighting});

  final Sighting sighting;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Ver foto del Lo vi',
      child: GestureDetector(
        onTap: () => _openPhoto(context),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(
            height: 170,
            width: double.infinity,
            child: Stack(
              fit: StackFit.expand,
              children: [
                CachedAppImage(
                  imageUrl: sighting.photoUrl,
                  fit: BoxFit.cover,
                  icon: Icons.visibility,
                  cacheWidth: 720,
                  cacheHeight: 360,
                ),
                Positioned(
                  left: 10,
                  bottom: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.52),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.zoom_in, color: Colors.white, size: 18),
                        SizedBox(width: 6),
                        Text(
                          'Ver foto',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _openPhoto(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (context) {
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 18,
            vertical: 28,
          ),
          backgroundColor: Colors.transparent,
          child: Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(22),
                child: CachedAppImage(
                  imageUrl: sighting.photoUrl,
                  width: double.infinity,
                  height: MediaQuery.of(context).size.height * 0.68,
                  fit: BoxFit.cover,
                  icon: Icons.visibility,
                  cacheWidth: 900,
                ),
              ),
              Positioned(
                left: 12,
                right: 58,
                bottom: 12,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.58),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(
                    sighting.comment.isEmpty
                        ? 'Sin comentario adicional.'
                        : sighting.comment,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white),
                  ),
                ),
              ),
              Positioned(
                top: 10,
                right: 10,
                child: IconButton.filled(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.black.withValues(alpha: 0.52),
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SightingDetailRows extends StatelessWidget {
  const _SightingDetailRows({required this.sighting});

  final Sighting sighting;

  @override
  Widget build(BuildContext context) {
    final coordinates =
        '${sighting.latitude?.toStringAsFixed(5) ?? '-'}, ${sighting.longitude?.toStringAsFixed(5) ?? '-'}';

    return Column(
      children: [
        _SightingDetailRow(
          icon: Icons.chat_bubble_outline,
          label: 'Comentario',
          value: sighting.comment.isEmpty
              ? 'Sin comentario adicional.'
              : sighting.comment,
        ),
        _SightingDetailRow(
          icon: Icons.schedule,
          label: 'Fecha',
          value: _formatSightingDate(sighting.seenAt ?? sighting.createdAt),
        ),
        _SightingDetailRow(
          icon: Icons.place_outlined,
          label: 'Ubicacion',
          value: coordinates,
        ),
        _SightingDetailRow(
          icon: sighting.photoUrl == null || sighting.photoUrl!.isEmpty
              ? Icons.image_not_supported_outlined
              : Icons.photo_camera_outlined,
          label: 'Evidencia',
          value: sighting.photoUrl == null || sighting.photoUrl!.isEmpty
              ? 'Sin foto'
              : 'Foto incluida',
        ),
      ],
    );
  }
}

class _SightingDetailRow extends StatelessWidget {
  const _SightingDetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: HuellamiGOColors.mint,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 17, color: HuellamiGOColors.forest),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: HuellamiGOColors.forest,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(value, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchTrailSummary extends StatelessWidget {
  const _SearchTrailSummary({required this.sightings});

  final List<Sighting> sightings;

  @override
  Widget build(BuildContext context) {
    final orderedSightings = _orderedTrailSightings;
    final leadSighting = orderedSightings.isEmpty ? null : orderedSightings[0];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const _SectionTitleIcon(icon: Icons.route_outlined),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'Resumen del rastro',
                style: TextStyle(
                  color: HuellamiGOColors.forest,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: HuellamiGOColors.coral.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '${orderedSightings.length}',
                style: const TextStyle(
                  color: HuellamiGOColors.coral,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (leadSighting == null)
          const AppMessageState(
            icon: Icons.route_outlined,
            title: 'Sin pistas destacadas',
            message:
                'Marca Lo vi como utiles o pista clave para formar el rastro.',
          )
        else
          _PrivateManageCard(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: leadSighting.isTrailKey
                            ? HuellamiGOColors.coral.withValues(alpha: 0.16)
                            : HuellamiGOColors.mint,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        leadSighting.isTrailKey
                            ? Icons.star
                            : Icons.check_circle_outline,
                        color: leadSighting.isTrailKey
                            ? HuellamiGOColors.coral
                            : HuellamiGOColors.forest,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            leadSighting.isTrailKey
                                ? 'Pista clave'
                                : 'Ultima pista util',
                            style: const TextStyle(
                              color: HuellamiGOColors.forest,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text(
                            _formatSightingDate(
                              leadSighting.seenAt ?? leadSighting.createdAt,
                            ),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  leadSighting.comment.isEmpty
                      ? 'Sin comentario adicional.'
                      : leadSighting.comment,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    _ManagePill(
                      icon: Icons.place,
                      label:
                          '${leadSighting.latitude?.toStringAsFixed(5) ?? '-'}, ${leadSighting.longitude?.toStringAsFixed(5) ?? '-'}',
                    ),
                    _ManagePill(
                      icon: Icons.verified_user,
                      label:
                          'Confianza ${leadSighting.confidenceLabel} (${leadSighting.trustScore}/100)',
                    ),
                  ],
                ),
                if (orderedSightings.length > 1) ...[
                  const SizedBox(height: 12),
                  ...orderedSightings
                      .skip(1)
                      .take(4)
                      .map((sighting) => _TrailMiniRow(sighting: sighting)),
                ],
              ],
            ),
          ),
      ],
    );
  }

  List<Sighting> get _orderedTrailSightings {
    final items = sightings
        .where(
          (sighting) =>
              !sighting.isHidden && (sighting.isTrailKey || sighting.isUseful),
        )
        .toList();

    items.sort((left, right) {
      if (left.isTrailKey != right.isTrailKey) {
        return left.isTrailKey ? -1 : 1;
      }

      if (left.isUseful != right.isUseful) {
        return left.isUseful ? -1 : 1;
      }

      final confidenceDifference = right.trustScore.compareTo(left.trustScore);
      if (confidenceDifference != 0) {
        return confidenceDifference;
      }

      return _sightingTime(right).compareTo(_sightingTime(left));
    });

    return items;
  }

  DateTime _sightingTime(Sighting sighting) {
    return DateTime.tryParse(sighting.seenAt ?? sighting.createdAt ?? '') ??
        DateTime.fromMillisecondsSinceEpoch(0);
  }
}

class _TrailMiniRow extends StatelessWidget {
  const _TrailMiniRow({required this.sighting});

  final Sighting sighting;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Icon(
            sighting.isTrailKey ? Icons.star : Icons.check_circle_outline,
            color: sighting.isTrailKey
                ? HuellamiGOColors.coral
                : HuellamiGOColors.forest,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              sighting.comment.isEmpty
                  ? _formatSightingDate(sighting.seenAt ?? sighting.createdAt)
                  : sighting.comment,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

class _FramedPetPhoto extends StatelessWidget {
  const _FramedPetPhoto({required this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final hasPhoto = imageUrl != null && imageUrl!.isNotEmpty;

    return Semantics(
      button: hasPhoto,
      label: 'Foto de la mascota',
      child: GestureDetector(
        onTap: hasPhoto ? () => _openPhotoZoom(context) : null,
        child: SizedBox(
          width: 99,
          height: 128,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Positioned(
                top: 32,
                child: SizedBox(
                  width: 70,
                  height: 68,
                  child: ClipOval(
                    child: CachedAppImage(
                      imageUrl: imageUrl,
                      width: 70,
                      height: 68,
                      fit: BoxFit.cover,
                      icon: Icons.pets,
                      cacheWidth: 97,
                      cacheHeight: 95,
                    ),
                  ),
                ),
              ),
              Positioned.fill(
                child: Image.asset(
                  HuellamiGOAssets.petFrame,
                  fit: BoxFit.contain,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openPhotoZoom(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (context) {
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 18,
            vertical: 28,
          ),
          backgroundColor: Colors.transparent,
          child: Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(22),
                child: CachedAppImage(
                  imageUrl: imageUrl,
                  width: double.infinity,
                  height: MediaQuery.of(context).size.height * 0.68,
                  fit: BoxFit.cover,
                  icon: Icons.pets,
                  cacheWidth: 720,
                ),
              ),
              Positioned(
                top: 10,
                right: 10,
                child: IconButton.filled(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.black.withValues(alpha: 0.52),
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SightingAvatar extends StatelessWidget {
  const _SightingAvatar({required this.sighting});

  final Sighting sighting;

  @override
  Widget build(BuildContext context) {
    if (sighting.photoUrl != null && sighting.photoUrl!.isNotEmpty) {
      return ClipOval(
        child: CachedAppImage(
          imageUrl: sighting.photoUrl,
          width: 40,
          height: 40,
          fit: BoxFit.cover,
          icon: Icons.visibility,
          cacheWidth: 40,
          cacheHeight: 40,
        ),
      );
    }

    return Container(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(
        color: HuellamiGOColors.mint,
        shape: BoxShape.circle,
      ),
      child: const Icon(
        Icons.visibility,
        color: HuellamiGOColors.forest,
        size: 22,
      ),
    );
  }
}

class _PrivateManageCard extends StatelessWidget {
  const _PrivateManageCard({required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: HuellamiGOColors.paper,
        border: Border.all(color: HuellamiGOColors.line),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: HuellamiGOColors.forest.withValues(alpha: 0.07),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _ManageSuccessMessage extends StatelessWidget {
  const _ManageSuccessMessage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFEAF6E8),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: HuellamiGOColors.sage.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.favorite_border,
            color: HuellamiGOColors.forest,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: HuellamiGOColors.forest,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusHeaderIcon extends StatelessWidget {
  const _StatusHeaderIcon();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: HuellamiGOColors.coral.withValues(alpha: 0.12),
        shape: BoxShape.circle,
      ),
      child: const Icon(
        Icons.inventory_2_outlined,
        color: HuellamiGOColors.coral,
        size: 22,
      ),
    );
  }
}

class _SectionTitleIcon extends StatelessWidget {
  const _SectionTitleIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        color: HuellamiGOColors.coral.withValues(alpha: 0.12),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, size: 18, color: HuellamiGOColors.coral),
    );
  }
}

class _StoryField extends StatelessWidget {
  const _StoryField({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return _DashedBox(
      minHeight: 106,
      child: TextField(
        controller: controller,
        maxLength: 180,
        maxLines: 4,
        minLines: 4,
        decoration: const InputDecoration(
          isDense: true,
          filled: false,
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          counterText: '',
          contentPadding: EdgeInsets.zero,
          labelText: 'Historia de reencuentro',
          hintText: 'Cuentanos como fue el reencuentro...',
        ),
      ),
    );
  }
}

class _PublicStoryToggle extends StatelessWidget {
  const _PublicStoryToggle({
    required this.value,
    required this.saving,
    required this.onChanged,
  });

  final bool value;
  final bool saving;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      'Mostrar historia en comunidad',
                      style: TextStyle(
                        color: HuellamiGOColors.forest,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  SizedBox(width: 4),
                  Icon(
                    Icons.info_outline,
                    size: 14,
                    color: HuellamiGOColors.forest,
                  ),
                ],
              ),
              SizedBox(height: 2),
              Text(
                'Comparte tu historia para inspirar a otros.',
                style: TextStyle(fontSize: 10),
              ),
            ],
          ),
        ),
        Switch(
          value: value,
          onChanged: saving ? null : onChanged,
          activeThumbColor: HuellamiGOColors.sage,
        ),
      ],
    );
  }
}

class _ReunionPhotoPicker extends StatelessWidget {
  const _ReunionPhotoPicker({
    required this.photos,
    required this.saving,
    required this.picking,
    required this.onPickPhoto,
    required this.onRemovePhoto,
  });

  static const _maxPhotos = 2;

  final List<_ReunionPhotoDraft> photos;
  final bool saving;
  final bool picking;
  final VoidCallback onPickPhoto;
  final ValueChanged<_ReunionPhotoDraft> onRemovePhoto;

  @override
  Widget build(BuildContext context) {
    final canAdd = photos.length < _maxPhotos && !saving && !picking;
    final addButton = _AddReunionPhotoButton(
      enabled: canAdd,
      picking: picking,
      onPressed: onPickPhoto,
    );
    final firstSlot = photos.isNotEmpty
        ? _ReunionPhotoPreview(
            photo: photos[0],
            saving: saving,
            onRemove: () => onRemovePhoto(photos[0]),
          )
        : addButton;
    final secondSlot = photos.length > 1
        ? _ReunionPhotoPreview(
            photo: photos[1],
            saving: saving,
            onRemove: () => onRemovePhoto(photos[1]),
          )
        : photos.isEmpty
        ? const SizedBox.shrink()
        : addButton;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Fotos de reencuentro',
                style: TextStyle(
                  color: HuellamiGOColors.forest,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            Text(
              '${photos.length}/$_maxPhotos',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: firstSlot),
            const SizedBox(width: 8),
            Expanded(child: secondSlot),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          'Opcional. Puedes agregar hasta 2 fotos para la historia publica.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _ReunionPhotoPreview extends StatelessWidget {
  const _ReunionPhotoPreview({
    required this.photo,
    required this.saving,
    required this.onRemove,
  });

  final _ReunionPhotoDraft photo;
  final bool saving;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.memory(photo.bytes, fit: BoxFit.cover),
            Positioned(
              top: 6,
              right: 6,
              child: Material(
                color: HuellamiGOColors.paper.withValues(alpha: 0.92),
                shape: const CircleBorder(),
                child: IconButton(
                  tooltip: 'Quitar foto',
                  visualDensity: VisualDensity.compact,
                  iconSize: 18,
                  onPressed: saving ? null : onRemove,
                  icon: const Icon(Icons.close, color: HuellamiGOColors.forest),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddReunionPhotoButton extends StatelessWidget {
  const _AddReunionPhotoButton({
    required this.enabled,
    required this.picking,
    required this.onPressed,
  });

  final bool enabled;
  final bool picking;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1,
      child: OutlinedButton(
        onPressed: enabled ? onPressed : null,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.all(10),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        child: picking
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.add_a_photo_outlined, size: 22),
                  SizedBox(height: 6),
                  Text('Agregar', maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
      ),
    );
  }
}

class _DashedBox extends StatelessWidget {
  const _DashedBox({required this.child, this.minHeight = 0});

  final Widget child;
  final double minHeight;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _DashedBorderPainter(),
      child: Container(
        constraints: BoxConstraints(minHeight: minHeight),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: child,
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(14)),
      );
    final paint = Paint()
      ..color = HuellamiGOColors.coral.withValues(alpha: 0.42)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    const dashWidth = 5.0;
    const dashSpace = 4.0;

    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = distance + dashWidth;
        canvas.drawPath(metric.extractPath(distance, next), paint);
        distance = next + dashSpace;
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

enum _PillTone { mint, coral }

class _ManagePill extends StatelessWidget {
  const _ManagePill({
    required this.icon,
    required this.label,
    this.tone = _PillTone.mint,
  });

  final IconData icon;
  final String label;
  final _PillTone tone;

  @override
  Widget build(BuildContext context) {
    final isCoral = tone == _PillTone.coral;
    final color = isCoral ? HuellamiGOColors.coral : HuellamiGOColors.forest;
    final background = isCoral
        ? HuellamiGOColors.coral.withValues(alpha: 0.12)
        : HuellamiGOColors.mint;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ManagedReportData {
  const _ManagedReportData({required this.report, required this.sightings});

  final PetReport report;
  final List<Sighting> sightings;
}

String _formatSightingDate(String? value) {
  if (value == null || value.isEmpty) {
    return 'Fecha no disponible';
  }

  final date = DateTime.tryParse(value);
  if (date == null) {
    return 'Fecha no disponible';
  }

  final local = date.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  final year = local.year.toString();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');

  return '$day/$month/$year $hour:$minute';
}
