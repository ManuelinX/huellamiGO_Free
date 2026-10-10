import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../api/api_client.dart';
import '../models/pet_report.dart';
import '../models/report_map_item.dart';
import '../models/report_status.dart';
import '../widgets/app_feedback.dart';
import '../widgets/huellamigo_ui.dart';
import '../widgets/pet_widgets.dart';
import 'pet_detail_screen.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  List<ReportMapItem> _mapItems = const <ReportMapItem>[];
  final Map<String, List<ReportMapItem>> _viewportCache =
      <String, List<ReportMapItem>>{};
  PetReport? _selectedReport;
  LatLng? _currentLocation;
  Object? _mapError;
  bool _mapLoading = true;
  bool _viewportLoading = false;
  bool _locationLoading = false;
  String? _locationMessage;

  @override
  void initState() {
    super.initState();
    _loadInitialMapItems();
    _loadCurrentLocation();
  }

  Future<void> _refreshReports() async {
    setState(() {
      _selectedReport = null;
      _mapLoading = true;
      _mapError = null;
    });
    await _loadInitialMapItems();
  }

  static const _initialBbox = <double>[-118, 14, -86, 33];
  static const _viewportOverscanRatio = 0.45;
  static const _maxViewportCacheEntries = 24;

  Future<List<ReportMapItem>> _loadMapItems(List<double> bbox, double zoom) {
    return widget.api.getReportMap(bbox: bbox, zoom: zoom);
  }

  Future<void> _loadInitialMapItems() async {
    try {
      final items = await _loadMapItems(_initialBbox, 5);
      _rememberViewport(_initialBbox, 5, items);
      if (!mounted) {
        return;
      }
      setState(() {
        _mapItems = items;
        _mapLoading = false;
        _mapError = null;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _mapLoading = false;
        _mapError = error;
      });
    }
  }

  Future<void> _loadViewport(List<double> bbox, double zoom) async {
    final expandedBbox = _expandBbox(bbox);
    final cacheKey = _viewportCacheKey(expandedBbox, zoom);
    final cachedItems = _viewportCache[cacheKey];

    if (cachedItems != null) {
      setState(() {
        _mapItems = cachedItems;
        _mapLoading = false;
        _mapError = null;
      });
    }

    if (_viewportLoading) {
      return;
    }

    _viewportLoading = true;
    final previousItems = _mapItems;

    try {
      final items = await _loadMapItems(expandedBbox, zoom);
      _rememberViewport(expandedBbox, zoom, items);
      if (!mounted) {
        return;
      }
      setState(() {
        _mapItems = items;
        _mapLoading = false;
        _mapError = null;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _mapItems = previousItems;
        _mapLoading = previousItems.isEmpty;
        _mapError = previousItems.isEmpty ? error : null;
      });
    } finally {
      _viewportLoading = false;
    }
  }

  List<double> _expandBbox(List<double> bbox) {
    final west = bbox[0];
    final south = bbox[1];
    final east = bbox[2];
    final north = bbox[3];
    final lngPadding = (east - west).abs() * _viewportOverscanRatio;
    final latPadding = (north - south).abs() * _viewportOverscanRatio;

    return <double>[
      (west - lngPadding).clamp(-180.0, 180.0),
      (south - latPadding).clamp(-90.0, 90.0),
      (east + lngPadding).clamp(-180.0, 180.0),
      (north + latPadding).clamp(-90.0, 90.0),
    ];
  }

  String _viewportCacheKey(List<double> bbox, double zoom) {
    final roundedZoom = (zoom * 2).round() / 2;
    return [
      roundedZoom.toStringAsFixed(1),
      ...bbox.map((value) => value.toStringAsFixed(2)),
    ].join('|');
  }

  void _rememberViewport(
    List<double> bbox,
    double zoom,
    List<ReportMapItem> items,
  ) {
    final cacheKey = _viewportCacheKey(bbox, zoom);
    _viewportCache.remove(cacheKey);
    _viewportCache[cacheKey] = List<ReportMapItem>.unmodifiable(items);

    while (_viewportCache.length > _maxViewportCacheEntries) {
      _viewportCache.remove(_viewportCache.keys.first);
    }
  }

  Future<void> _loadCurrentLocation({bool showMessages = false}) async {
    setState(() {
      _locationLoading = true;
      _locationMessage = null;
    });

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _setLocationMessage(
          'Activa la ubicacion del dispositivo para centrar el mapa.',
          showMessages,
        );
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        _setLocationMessage('Permiso de ubicacion denegado.', showMessages);
        return;
      }

      if (permission == LocationPermission.deniedForever) {
        _setLocationMessage(
          'Permiso de ubicacion bloqueado. Activalo desde ajustes.',
          showMessages,
        );
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _currentLocation = LatLng(position.latitude, position.longitude);
        _locationLoading = false;
        _locationMessage = null;
      });
    } catch (error) {
      _setLocationMessage(
        'No se pudo obtener tu ubicacion: $error',
        showMessages,
      );
    }
  }

  void _setLocationMessage(String message, bool showSnackBar) {
    if (!mounted) {
      return;
    }

    setState(() {
      _locationLoading = false;
      _locationMessage = showSnackBar ? message : null;
    });

    if (showSnackBar) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  void _openDetail(PetReport report) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PetDetailScreen(api: widget.api, initialReport: report),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final reportCount = _mapItems.fold<int>(
      0,
      (total, item) => total + (item.isCluster ? item.count ?? 0 : 1),
    );

    return Column(
      children: [
        _MapHeader(count: reportCount, onRefresh: _refreshReports),
        if (_locationMessage != null)
          _LocationNotice(
            message: _locationMessage!,
            onRetry: () => _loadCurrentLocation(showMessages: true),
          ),
        Expanded(
          child: _mapLoading && _mapItems.isEmpty
              ? const AppLoadingState(
                  center: true,
                  title: 'Cargando mapa',
                  message: 'Buscando reportes activos.',
                )
              : _mapError != null && _mapItems.isEmpty
              ? AppMessageState(
                  icon: Icons.map,
                  title: friendlyErrorTitle(
                    _mapError,
                    fallback: 'No se pudo cargar el mapa',
                  ),
                  message: friendlyErrorMessage(_mapError),
                  center: true,
                  accentColor: HuellamiGOColors.coral,
                  action: OutlinedButton.icon(
                    onPressed: _refreshReports,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Reintentar'),
                  ),
                )
              : _ReportsMap(
                  items: _mapItems,
                  selectedReport: _selectedReport,
                  currentLocation: _currentLocation,
                  locationLoading: _locationLoading,
                  onSelectReport: (report) =>
                      setState(() => _selectedReport = report),
                  onCloseCard: () => setState(() => _selectedReport = null),
                  onOpenDetail: _openDetail,
                  onLocateMe: () => _loadCurrentLocation(showMessages: true),
                  onViewportChanged: _loadViewport,
                ),
        ),
      ],
    );
  }
}

class _MapHeader extends StatelessWidget {
  const _MapHeader({required this.count, required this.onRefresh});

  final int count;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: HuellamiGOColors.paper,
          border: Border.all(color: HuellamiGOColors.line),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: HuellamiGOColors.forest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.map, color: Colors.white),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AppEyebrow('Avistamientos cercanos'),
                  Text(
                    '$count reportes activos con ubicacion',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh),
              tooltip: 'Actualizar mapa',
            ),
          ],
        ),
      ),
    );
  }
}

class _LocationNotice extends StatelessWidget {
  const _LocationNotice({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: HuellamiGOColors.mint,
          border: Border.all(color: HuellamiGOColors.line),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.my_location,
              size: 18,
              color: HuellamiGOColors.forest,
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
            TextButton(onPressed: onRetry, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}

class _ReportsMap extends StatefulWidget {
  const _ReportsMap({
    required this.items,
    required this.selectedReport,
    required this.currentLocation,
    required this.locationLoading,
    required this.onSelectReport,
    required this.onCloseCard,
    required this.onOpenDetail,
    required this.onLocateMe,
    required this.onViewportChanged,
  });

  static const LatLng _fallbackCenter = LatLng(23.6345, -102.5528);

  final List<ReportMapItem> items;
  final PetReport? selectedReport;
  final LatLng? currentLocation;
  final bool locationLoading;
  final ValueChanged<PetReport> onSelectReport;
  final VoidCallback onCloseCard;
  final ValueChanged<PetReport> onOpenDetail;
  final VoidCallback onLocateMe;
  final void Function(List<double> bbox, double zoom) onViewportChanged;

  @override
  State<_ReportsMap> createState() => _ReportsMapState();
}

class _ReportsMapState extends State<_ReportsMap> {
  final MapController _mapController = MapController();
  Timer? _viewportDebounce;
  List<PetReport> _selectedNearbyGroup = const <PetReport>[];

  @override
  void dispose() {
    _viewportDebounce?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _ReportsMap oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.items != oldWidget.items) {
      _selectedNearbyGroup = const <PetReport>[];
    }

    final location = widget.currentLocation;
    if (location != null && location != oldWidget.currentLocation) {
      _mapController.move(location, 14);
    }
  }

  @override
  Widget build(BuildContext context) {
    final center = _initialCenter();
    final reportGroups = _groupNearbyReports();
    final safeBottom = MediaQuery.of(context).padding.bottom + 16;

    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: center,
            initialZoom: _initialZoom(),
            minZoom: 4,
            maxZoom: 18,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
            onMapReady: _notifyViewportChanged,
            onPositionChanged: (_, hasGesture) {
              if (hasGesture) {
                _scheduleViewportChanged();
              }
            },
          ),
          children: [
            TileLayer(
              // CARTO usa datos de OSM sin depender del servidor publico de
              // tiles de OpenStreetMap, que flutter_map advierte no usar en
              // apps de produccion.
              minZoom: 4,
              maxZoom: 18,
              maxNativeZoom: 18,
              urlTemplate:
                  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              subdomains: const ['a', 'b', 'c', 'd'],
              userAgentPackageName: 'com.huellamigo.mobile',
            ),
            MarkerLayer(
              markers: [
                if (widget.currentLocation != null)
                  Marker(
                    point: widget.currentLocation!,
                    width: 34,
                    height: 34,
                    child: const _CurrentLocationMarker(),
                  ),
                ...widget.items.map((item) {
                  if (item.isCluster) {
                    return Marker(
                      point: LatLng(item.latitude, item.longitude),
                      width: 54,
                      height: 54,
                      child: _ClusterMarker(
                        count: item.count ?? 0,
                        onTap: () => _focusCluster(item),
                      ),
                    );
                  }

                  return null;
                }).whereType<Marker>(),
                ...reportGroups.map((group) {
                  if (group.reports.length > 1) {
                    return Marker(
                      point: group.center,
                      width: 58,
                      height: 58,
                      child: _ClusterMarker(
                        count: group.reports.length,
                        onTap: () {
                          widget.onCloseCard();
                          setState(() => _selectedNearbyGroup = group.reports);
                        },
                      ),
                    );
                  }

                  final report = group.reports.first;
                  return Marker(
                    point: LatLng(report.latitude!, report.longitude!),
                    width: 58,
                    height: 58,
                    child: _ReportMarker(
                      selected: widget.selectedReport?.id == report.id,
                      onTap: () {
                        setState(
                          () => _selectedNearbyGroup = const <PetReport>[],
                        );
                        widget.onSelectReport(report);
                      },
                    ),
                  );
                }),
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
        if (widget.selectedReport != null && _selectedNearbyGroup.isEmpty)
          Positioned(
            left: 16,
            right: 16,
            bottom: safeBottom,
            child: _SelectedReportCard(
              report: widget.selectedReport!,
              onClose: widget.onCloseCard,
              onOpenDetail: () => widget.onOpenDetail(widget.selectedReport!),
            ),
          ),
        if (_selectedNearbyGroup.isNotEmpty)
          Positioned(
            left: 16,
            right: 16,
            bottom: safeBottom,
            child: _NearbyGroupCard(
              reports: _selectedNearbyGroup,
              onClose: () =>
                  setState(() => _selectedNearbyGroup = const <PetReport>[]),
              onSelectReport: (report) {
                setState(() => _selectedNearbyGroup = const <PetReport>[]);
                widget.onSelectReport(report);
              },
            ),
          ),
        Positioned(
          right: 16,
          top: 16,
          child: FloatingActionButton.small(
            heroTag: 'mapLocateMe',
            onPressed: widget.locationLoading ? null : widget.onLocateMe,
            tooltip: 'Mi ubicacion',
            child: widget.locationLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.my_location),
          ),
        ),
      ],
    );
  }

  void _scheduleViewportChanged() {
    _viewportDebounce?.cancel();
    _viewportDebounce = Timer(
      const Duration(milliseconds: 205),
      _notifyViewportChanged,
    );
  }

  void _notifyViewportChanged() {
    if (!mounted) {
      return;
    }
    final camera = _mapController.camera;
    final bounds = camera.visibleBounds;
    widget.onViewportChanged(<double>[
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north,
    ], camera.zoom);
  }

  void _focusCluster(ReportMapItem cluster) {
    widget.onCloseCard();
    setState(() => _selectedNearbyGroup = const <PetReport>[]);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text('Acerca el mapa para ver los reportes.'),
          duration: Duration(seconds: 2),
        ),
      );

    final bounds = cluster.bounds;
    if (bounds != null) {
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds(
            LatLng(bounds.south, bounds.west),
            LatLng(bounds.north, bounds.east),
          ),
          maxZoom: 14,
          padding: const EdgeInsets.all(28),
        ),
      );
      _scheduleViewportChanged();
      return;
    }

    _mapController.move(
      LatLng(cluster.latitude, cluster.longitude),
      (_mapController.camera.zoom + 2).clamp(4, 14).toDouble(),
    );
    _scheduleViewportChanged();
  }

  LatLng _initialCenter() {
    final location = widget.currentLocation;
    if (location != null) {
      return location;
    }

    final reports = widget.items
        .where((item) => item.isReport && item.report != null)
        .map((item) => item.report!)
        .where((report) => report.latitude != null && report.longitude != null)
        .toList();

    if (reports.isEmpty) {
      return _ReportsMap._fallbackCenter;
    }

    final latTotal = reports.fold<double>(
      0,
      (total, report) => total + report.latitude!,
    );
    final lngTotal = reports.fold<double>(
      0,
      (total, report) => total + report.longitude!,
    );

    return LatLng(latTotal / reports.length, lngTotal / reports.length);
  }

  double _initialZoom() {
    if (widget.currentLocation != null) {
      return 14;
    }

    if (widget.items.isEmpty) {
      return 5;
    }

    return 12;
  }

  List<_NearbyReportGroup> _groupNearbyReports() {
    final reports = widget.items
        .where((item) => item.isReport && item.report != null)
        .map((item) => item.report!)
        .where(
          (report) =>
              report.latitude != null &&
              report.longitude != null &&
              ReportStatus.isActive(report.status),
        )
        .toList();

    final zoom = _safeZoom();
    final groups = <_NearbyReportGroup>[];

    for (final report in reports) {
      final reportPoint = LatLng(report.latitude!, report.longitude!);
      final screenPoint = _worldPixelPoint(reportPoint, zoom);
      var added = false;

      for (var index = 0; index < groups.length; index += 1) {
        final group = groups[index];
        final visuallyClose = group.screenPoints.any(
          (point) => (point - screenPoint).distance <= 40,
        );
        final physicallyClose = group.reports.any(
          (candidate) =>
              _distanceMeters(
                LatLng(candidate.latitude!, candidate.longitude!),
                reportPoint,
              ) <=
              20,
        );

        if (visuallyClose || physicallyClose) {
          groups[index] = group.add(report, screenPoint);
          added = true;
          break;
        }
      }

      if (!added) {
        groups.add(_NearbyReportGroup.single(report, screenPoint));
      }
    }

    return groups;
  }

  double _safeZoom() {
    try {
      return _mapController.camera.zoom;
    } catch (_) {
      return _initialZoom();
    }
  }

  Offset _worldPixelPoint(LatLng point, double zoom) {
    final scale = 256.0 * math.pow(2, zoom);
    final sinLatitude = math.sin(point.latitudeInRad).clamp(-0.9999, 0.9999);
    final x = (point.longitude + 180) / 360 * scale;
    final y =
        (0.5 -
            math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * math.pi)) *
        scale;
    return Offset(x, y);
  }

  double _distanceMeters(LatLng a, LatLng b) {
    const earthRadiusMeters = 6371000.0;
    final dLat = b.latitudeInRad - a.latitudeInRad;
    final dLng = b.longitudeInRad - a.longitudeInRad;
    final sinLat = math.sin(dLat / 2);
    final sinLng = math.sin(dLng / 2);
    final haversine =
        sinLat * sinLat +
        math.cos(a.latitudeInRad) * math.cos(b.latitudeInRad) * sinLng * sinLng;
    return earthRadiusMeters *
        2 *
        math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine));
  }
}

class _NearbyReportGroup {
  const _NearbyReportGroup({
    required this.reports,
    required this.screenPoints,
    required this.center,
  });

  final List<PetReport> reports;
  final List<Offset> screenPoints;
  final LatLng center;

  factory _NearbyReportGroup.single(PetReport report, Offset screenPoint) {
    return _NearbyReportGroup(
      reports: [report],
      screenPoints: [screenPoint],
      center: LatLng(report.latitude!, report.longitude!),
    );
  }

  _NearbyReportGroup add(PetReport report, Offset screenPoint) {
    final nextReports = [...reports, report];
    final latitude =
        nextReports.fold<double>(0, (total, item) => total + item.latitude!) /
        nextReports.length;
    final longitude =
        nextReports.fold<double>(0, (total, item) => total + item.longitude!) /
        nextReports.length;

    return _NearbyReportGroup(
      reports: nextReports,
      screenPoints: [...screenPoints, screenPoint],
      center: LatLng(latitude, longitude),
    );
  }
}

class _CurrentLocationMarker extends StatelessWidget {
  const _CurrentLocationMarker();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: HuellamiGOColors.sage.withValues(alpha: 0.22),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Container(
          width: 16,
          height: 16,
          decoration: BoxDecoration(
            color: HuellamiGOColors.forest,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 3),
          ),
        ),
      ),
    );
  }
}

class _ReportMarker extends StatelessWidget {
  const _ReportMarker({required this.selected, required this.onTap});

  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedScale(
        scale: selected ? 1.12 : 1,
        duration: const Duration(milliseconds: 140),
        child: Image.asset(
          selected
              ? HuellamiGOAssets.markerLostCoral
              : HuellamiGOAssets.markerReportNavy,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
        ),
      ),
    );
  }
}

class _ClusterMarker extends StatelessWidget {
  const _ClusterMarker({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: HuellamiGOColors.forest,
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
        child: Center(
          child: Text(
            count > 99 ? '99+' : count.toString(),
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ),
    );
  }
}

class _NearbyGroupCard extends StatelessWidget {
  const _NearbyGroupCard({
    required this.reports,
    required this.onClose,
    required this.onSelectReport,
  });

  final List<PetReport> reports;
  final VoidCallback onClose;
  final ValueChanged<PetReport> onSelectReport;

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
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: HuellamiGOColors.forest,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.pets, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const AppEyebrow('Zona cercana'),
                      Text(
                        '${reports.length} reportes en esta zona',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: onClose,
                  icon: const Icon(Icons.close),
                  tooltip: 'Cerrar',
                  constraints: const BoxConstraints.tightFor(
                    width: 34,
                    height: 34,
                  ),
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 250),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: reports.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final report = reports[index];

                  return InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => onSelectReport(report),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: HuellamiGOColors.mint,
                        border: Border.all(color: HuellamiGOColors.line),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          PetThumbnail(
                            photoUrl: report.photoUrl,
                            size: 48,
                            borderRadius: 10,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  report.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontFamily: HuellamiGOFonts.display,
                                    color: HuellamiGOColors.forest,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w900,
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
                          const Icon(
                            Icons.chevron_right,
                            color: HuellamiGOColors.forest,
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SelectedReportCard extends StatelessWidget {
  const _SelectedReportCard({
    required this.report,
    required this.onClose,
    required this.onOpenDetail,
  });

  final PetReport report;
  final VoidCallback onClose;
  final VoidCallback onOpenDetail;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      color: HuellamiGOColors.paper.withValues(alpha: 0.97),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: HuellamiGOColors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: CachedAppImage(
                imageUrl: report.photoUrl,
                width: 58,
                height: 58,
                fit: BoxFit.cover,
                icon: Icons.pets,
                cacheWidth: 58,
                cacheHeight: 58,
                backgroundColor: HuellamiGOColors.forest,
                iconColor: HuellamiGOColors.paper,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          report.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: HuellamiGOFonts.display,
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: onClose,
                        icon: const Icon(Icons.close),
                        tooltip: 'Cerrar',
                        constraints: const BoxConstraints.tightFor(
                          width: 34,
                          height: 34,
                        ),
                        padding: EdgeInsets.zero,
                      ),
                    ],
                  ),
                  Text(
                    '${report.species} - ${report.zone}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 10),
                  FilledButton.icon(
                    onPressed: onOpenDetail,
                    icon: const Icon(Icons.arrow_forward, size: 18),
                    label: const Text('Ver detalle'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
