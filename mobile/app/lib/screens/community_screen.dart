import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../models/pet_report.dart';
import '../widgets/app_feedback.dart';
import '../widgets/huellamigo_ui.dart';
import '../widgets/pet_widgets.dart';
import '../widgets/screen_padding.dart';
import 'pet_detail_screen.dart';

class CommunityScreen extends StatefulWidget {
  const CommunityScreen({
    super.key,
    required this.api,
    required this.onReportTap,
  });

  final ApiClient api;
  final VoidCallback onReportTap;

  @override
  State<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends State<CommunityScreen> {
  late Future<_CommunityData> _communityFuture;

  @override
  void initState() {
    super.initState();
    _communityFuture = _loadCommunity();
  }

  Future<_CommunityData> _loadCommunity() async {
    final results = await Future.wait<Object?>([
      widget.api.getReports(),
      widget.api.getReunionStories(),
    ]);

    return _CommunityData(
      reports: results[0] as List<PetReport>,
      stories: results[1] as List<PetReport>,
    );
  }

  Future<void> _refreshCommunity() async {
    setState(() => _communityFuture = _loadCommunity());
    await _communityFuture;
  }

  void _openDetail(PetReport report) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PetDetailScreen(api: widget.api, initialReport: report),
      ),
    );
  }

  Future<void> _openStory(PetReport report) async {
    final openDetail = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black87,
      builder: (_) => _StoryViewer(report: report),
    );

    if (openDetail == true && mounted) {
      _openDetail(report);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_CommunityData>(
      future: _communityFuture,
      builder: (context, snapshot) {
        final data = snapshot.data;

        return RefreshIndicator(
          onRefresh: _refreshCommunity,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: scrollScreenPadding(context),
            children: [
              _CommunityHeader(onRefresh: _refreshCommunity),
              const SizedBox(height: 16),
              if (snapshot.connectionState != ConnectionState.done)
                const AppLoadingState(
                  title: 'Cargando comunidad',
                  message: 'Actualizando historias compartidas.',
                )
              else if (snapshot.hasError)
                AppMessageState(
                  icon: Icons.cloud_off,
                  title: friendlyErrorTitle(
                    snapshot.error,
                    fallback: 'No se pudo cargar comunidad',
                  ),
                  message: friendlyErrorMessage(snapshot.error),
                  accentColor: HuellamiGOColors.coral,
                  action: OutlinedButton.icon(
                    onPressed: _refreshCommunity,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Reintentar'),
                  ),
                )
              else ...[
                _StoriesSection(
                  stories: data?.stories ?? <PetReport>[],
                  onReportTap: widget.onReportTap,
                  onOpenStory: _openStory,
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _CommunityData {
  const _CommunityData({required this.reports, required this.stories});

  final List<PetReport> reports;
  final List<PetReport> stories;
}

class _CommunityHeader extends StatelessWidget {
  const _CommunityHeader({required this.onRefresh});

  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: HuellamiGOColors.mint,
            border: Border.all(color: HuellamiGOColors.line),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.groups, color: HuellamiGOColors.forest),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Comunidad', style: Theme.of(context).textTheme.titleMedium),
              Text(
                'Finales felices compartidos',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: onRefresh,
          icon: const Icon(Icons.refresh),
          tooltip: 'Actualizar comunidad',
        ),
      ],
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.title, this.action});

  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              fontFamily: HuellamiGOFonts.title,
              color: HuellamiGOColors.forest,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        ?action,
      ],
    );
  }
}

class _StoriesSection extends StatelessWidget {
  const _StoriesSection({
    required this.stories,
    required this.onReportTap,
    required this.onOpenStory,
  });

  final List<PetReport> stories;
  final VoidCallback onReportTap;
  final ValueChanged<PetReport> onOpenStory;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionHeading(
          title: 'Finales felices',
          action: TextButton.icon(
            onPressed: onReportTap,
            icon: const Icon(Icons.add_alert, size: 16),
            label: const Text('Reportar'),
          ),
        ),
        const SizedBox(height: 8),
        if (stories.isEmpty)
          const _EmptyStoriesCard()
        else
          ...stories.map(
            (story) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _StoryCard(report: story, onTap: () => onOpenStory(story)),
            ),
          ),
      ],
    );
  }
}

class _EmptyStoriesCard extends StatelessWidget {
  const _EmptyStoriesCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
      decoration: BoxDecoration(
        color: HuellamiGOColors.paper,
        border: Border.all(color: HuellamiGOColors.line),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: HuellamiGOColors.forest.withValues(alpha: 0.06),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Image.asset(
            'assets/resources/comunidad_back.png',
            height: 132,
            fit: BoxFit.contain,
          ),
          const SizedBox(height: 6),
          Text(
            'Aun no hay historias publicas',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 4),
          Text(
            'Cuando una familia comparta su reencuentro, aparecera aqui.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _StoryCard extends StatelessWidget {
  const _StoryCard({required this.report, required this.onTap});

  final PetReport report;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final storyPhoto =
        report.reunionStory.photoUrl ?? report.reunionStory.photoUrl2;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        decoration: BoxDecoration(
          color: HuellamiGOColors.mint,
          border: Border.all(color: HuellamiGOColors.line),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(13),
              ),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Container(
                  color: HuellamiGOColors.forest,
                  child: storyPhoto == null
                      ? _StoryTextPlaceholder(report: report)
                      : CachedAppImage(
                          imageUrl: storyPhoto,
                          fit: BoxFit.cover,
                          icon: Icons.favorite,
                          iconSize: 42,
                          backgroundColor: HuellamiGOColors.forest,
                          iconColor: HuellamiGOColors.paper,
                          cacheWidth: 640,
                          cacheHeight: 360,
                        ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${report.name} volvio a casa',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: HuellamiGOFonts.display,
                            color: HuellamiGOColors.forest,
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          report.reunionStory.message ??
                              'Una familia compartio su final feliz.',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 8),
                        AppEyebrow('${report.sightingsCount} Lo vi ayudaron'),
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
          ],
        ),
      ),
    );
  }
}

class _StoryTextPlaceholder extends StatelessWidget {
  const _StoryTextPlaceholder({required this.report, this.expanded = false});

  final PetReport report;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final message =
        report.reunionStory.message ??
        'Una familia compartio su final feliz con la comunidad.';

    return Container(
      width: double.infinity,
      height: double.infinity,
      padding: EdgeInsets.all(expanded ? 24 : 16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [HuellamiGOColors.forest, HuellamiGOColors.coral],
        ),
        borderRadius: BorderRadius.circular(expanded ? 22 : 0),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.favorite_border,
            color: HuellamiGOColors.paper,
            size: expanded ? 36 : 26,
          ),
          SizedBox(height: expanded ? 14 : 8),
          Text(
            message,
            maxLines: expanded ? 7 : 4,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: HuellamiGOColors.paper,
              fontSize: expanded ? 25 : 18,
              fontWeight: FontWeight.w900,
              height: 1.12,
            ),
          ),
        ],
      ),
    );
  }
}

class _StoryViewer extends StatefulWidget {
  const _StoryViewer({required this.report});

  final PetReport report;

  @override
  State<_StoryViewer> createState() => _StoryViewerState();
}

class _StoryViewerState extends State<_StoryViewer>
    with SingleTickerProviderStateMixin {
  static const _storyDuration = Duration(seconds: 24);

  final PageController _pageController = PageController();
  late final AnimationController _progressController;
  int _pageIndex = 0;

  @override
  void initState() {
    super.initState();
    _progressController = AnimationController(
      vsync: this,
      duration: _storyDuration,
    )..addStatusListener(_handleProgressStatus);
    _progressController.forward();
  }

  @override
  void dispose() {
    _progressController
      ..removeStatusListener(_handleProgressStatus)
      ..dispose();
    _pageController.dispose();
    super.dispose();
  }

  void _handleProgressStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed) {
      return;
    }

    final pageCount = _photos.isEmpty ? 1 : _photos.length;
    if (_pageIndex + 1 < pageCount) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOut,
      );
      return;
    }

    Navigator.of(context).pop(false);
  }

  List<String> get _photos {
    return [
      widget.report.reunionStory.photoUrl,
      widget.report.reunionStory.photoUrl2,
    ].whereType<String>().toList();
  }

  void _restartProgress() {
    _progressController
      ..reset()
      ..forward();
  }

  void _pauseProgress() {
    if (_progressController.isAnimating) {
      _progressController.stop();
    }
  }

  void _resumeProgress() {
    if (!_progressController.isAnimating &&
        _progressController.value < 1 &&
        mounted) {
      _progressController.forward();
    }
  }

  @override
  Widget build(BuildContext context) {
    final photos = _photos;
    final pageCount = photos.isEmpty ? 1 : photos.length;

    return Dialog.fullscreen(
      backgroundColor: Colors.black,
      child: SafeArea(
        child: Stack(
          children: [
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onLongPressStart: (_) => _pauseProgress(),
              onLongPressEnd: (_) => _resumeProgress(),
              child: PageView.builder(
                controller: _pageController,
                itemCount: pageCount,
                onPageChanged: (index) {
                  setState(() => _pageIndex = index);
                  _restartProgress();
                },
                itemBuilder: (context, index) {
                  if (photos.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: _StoryTextPlaceholder(
                          report: widget.report,
                          expanded: true,
                        ),
                      ),
                    );
                  }

                  return InteractiveViewer(
                    minScale: 1,
                    maxScale: 3,
                    child: Center(
                      child: CachedAppImage(
                        imageUrl: photos[index],
                        fit: BoxFit.contain,
                        icon: Icons.favorite,
                        iconSize: 72,
                        backgroundColor: Colors.transparent,
                        iconColor: Colors.white,
                        cacheWidth: 1080,
                        cacheHeight: 1080,
                      ),
                    ),
                  );
                },
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              top: 12,
              child: AnimatedBuilder(
                animation: _progressController,
                builder: (context, _) {
                  return Row(
                    children: List.generate(
                      pageCount,
                      (index) => Expanded(
                        child: _StoryProgressSegment(
                          value: index < _pageIndex
                              ? 1
                              : index == _pageIndex
                              ? _progressController.value
                              : 0,
                          margin: EdgeInsets.only(
                            right: index == pageCount - 1 ? 0 : 6,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            Positioned(
              right: 8,
              top: 26,
              child: IconButton(
                onPressed: () => Navigator.of(context).pop(false),
                icon: const Icon(Icons.close, color: Colors.white),
                tooltip: 'Cerrar',
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: _StoryViewerInfo(
                report: widget.report,
                onOpenDetail: () => Navigator.of(context).pop(true),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StoryViewerInfo extends StatelessWidget {
  const _StoryViewerInfo({required this.report, required this.onOpenDetail});

  final PetReport report;
  final VoidCallback onOpenDetail;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black.withValues(alpha: 0),
            Colors.black.withValues(alpha: 0.76),
          ],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(0, 32, 0, 0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${report.name} volvio a casa',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              report.reunionStory.message ??
                  'Una familia compartio su final feliz con la comunidad.',
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 15),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: onOpenDetail,
              icon: const Icon(Icons.arrow_forward),
              label: const Text('Ver detalles'),
            ),
          ],
        ),
      ),
    );
  }
}

class _StoryProgressSegment extends StatelessWidget {
  const _StoryProgressSegment({required this.value, required this.margin});

  final double value;
  final EdgeInsets margin;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: margin,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: LinearProgressIndicator(
          minHeight: 5,
          value: value.clamp(0, 1).toDouble(),
          backgroundColor: Colors.white.withValues(alpha: 0.28),
          valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
        ),
      ),
    );
  }
}
