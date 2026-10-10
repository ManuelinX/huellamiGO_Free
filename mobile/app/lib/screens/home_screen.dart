import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../models/pet_report.dart';
import '../widgets/app_feedback.dart';
import '../widgets/huellamigo_ui.dart';
import '../widgets/pet_widgets.dart';
import '../widgets/screen_padding.dart';
import 'pet_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.api, required this.onSelectTab});

  final ApiClient api;
  final ValueChanged<int> onSelectTab;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<PetReport>> _reportsFuture;

  @override
  void initState() {
    super.initState();
    _reportsFuture = widget.api.getReports();
  }

  Future<void> _refreshReports() async {
    setState(() => _reportsFuture = widget.api.getReports());
    await _reportsFuture;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<PetReport>>(
      future: _reportsFuture,
      builder: (context, snapshot) {
        final reports = snapshot.data ?? <PetReport>[];
        final hasReportList =
            snapshot.connectionState == ConnectionState.done &&
            !snapshot.hasError &&
            reports.isNotEmpty;
        final statusItemCount = hasReportList ? reports.length : 1;

        return RefreshIndicator(
          onRefresh: _refreshReports,
          child: ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: scrollScreenPadding(context),
            itemCount: 6 + statusItemCount,
            itemBuilder: (context, index) {
              return switch (index) {
                0 => _WelcomePanel(onReportTap: () => widget.onSelectTab(2)),
                1 => const SizedBox(height: 16),
                2 => _QuickActions(
                  onReportTap: () => widget.onSelectTab(2),
                  onMapTap: () => widget.onSelectTab(1),
                  onCommunityTap: () => widget.onSelectTab(3),
                  onProfileTap: () => widget.onSelectTab(4),
                ),
                3 => const SizedBox(height: 22),
                4 => _SectionTitle(count: reports.length),
                5 => const SizedBox(height: 12),
                _ when snapshot.connectionState != ConnectionState.done =>
                  const AppLoadingState(),
                _ when snapshot.hasError => AppMessageState(
                  icon: Icons.cloud_off,
                  title: friendlyErrorTitle(
                    snapshot.error,
                    fallback: 'No se pudieron cargar las alertas',
                  ),
                  message: friendlyErrorMessage(snapshot.error),
                  action: OutlinedButton.icon(
                    onPressed: _refreshReports,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Reintentar'),
                  ),
                ),
                _ when reports.isEmpty => const AppMessageState(
                  icon: Icons.check_circle_outline,
                  title: 'No hay alertas activas',
                  message: 'Cuando haya reportes cercanos apareceran aqui.',
                ),
                _ => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _PetAlertCard(
                    api: widget.api,
                    report: reports[index - 6],
                  ),
                ),
              };
            },
          ),
        );
      },
    );
  }
}

class _WelcomePanel extends StatelessWidget {
  const _WelcomePanel({required this.onReportTap});

  final VoidCallback onReportTap;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: Container(
        constraints: const BoxConstraints(minHeight: 240),
        decoration: BoxDecoration(
          color: HuellamiGOColors.paper,
          border: Border.all(color: HuellamiGOColors.line),
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: HuellamiGOColors.forest.withValues(alpha: 0.10),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: Image.asset(
                'assets/resources/hero2_mobile.webp',
                fit: BoxFit.cover,
                alignment: Alignment.bottomRight,
              ),
            ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      HuellamiGOColors.paper.withValues(alpha: 0.96),
                      HuellamiGOColors.paper.withValues(alpha: 0.42),
                      HuellamiGOColors.paper.withValues(alpha: 0),
                    ],
                    stops: const [0, 0.15, 0.30],
                  ),
                ),
              ),
            ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      HuellamiGOColors.paper.withValues(alpha: 0.94),
                      HuellamiGOColors.paper.withValues(alpha: 0.38),
                      HuellamiGOColors.paper.withValues(alpha: 0),
                    ],
                    stops: const [0, 0.30, 0.62],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 20, 14, 18),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 188),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AppEyebrow('Huella activa'),
                        SizedBox(width: 8),
                        Icon(
                          Icons.favorite,
                          size: 16,
                          color: HuellamiGOColors.gold,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Cada huella cuenta',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            color: HuellamiGOColors.navy,
                            fontSize: 32,
                            height: 1.04,
                          ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Reportes claros y vecinos listos para ayudar.',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontSize: 16,
                        height: 1.34,
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: 166,
                      child: FilledButton.icon(
                        onPressed: onReportTap,
                        icon: const Icon(Icons.add_alert),
                        label: const Text('Crear alerta'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({
    required this.onReportTap,
    required this.onMapTap,
    required this.onCommunityTap,
    required this.onProfileTap,
  });

  final VoidCallback onReportTap;
  final VoidCallback onMapTap;
  final VoidCallback onCommunityTap;
  final VoidCallback onProfileTap;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 4,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 0.78,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        _QuickActionButton(
          assetPath: 'assets/resources/icon_test/quick_report.png',
          label: 'Reportar',
          onTap: onReportTap,
        ),
        _QuickActionButton(
          assetPath: 'assets/resources/icon_test/quick_map.png',
          label: 'Mapa',
          onTap: onMapTap,
        ),
        _QuickActionButton(
          assetPath: 'assets/resources/icon_test/quick_community.png',
          label: 'Comunidad',
          onTap: onCommunityTap,
        ),
        _QuickActionButton(
          assetPath: 'assets/resources/icon_test/quick_profile.png',
          label: 'Perfil',
          onTap: onProfileTap,
        ),
      ],
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  const _QuickActionButton({
    required this.assetPath,
    required this.label,
    required this.onTap,
  });

  final String assetPath;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: HuellamiGOColors.paper,
      elevation: 2,
      borderRadius: BorderRadius.circular(16),
      shadowColor: HuellamiGOColors.forest.withValues(alpha: 0.16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: HuellamiGOColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 52,
                height: 52,
                child: Center(
                  child: Image.asset(
                    assetPath,
                    width: 50,
                    height: 50,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              SizedBox(
                height: 30,
                child: Center(
                  child: Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.visible,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.05,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.pets, color: HuellamiGOColors.forest, size: 18),
                SizedBox(width: 6),
                Text(
                  'Alertas',
                  style: TextStyle(
                    color: HuellamiGOColors.forest,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            Text(
              'Mascotas perdidas',
              style: TextStyle(
                fontFamily: HuellamiGOFonts.title,
                color: HuellamiGOColors.navy,
                fontSize: 24,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        Chip(
          avatar: const Icon(Icons.pets, size: 17),
          label: Text('$count activas'),
        ),
      ],
    );
  }
}

class _PetAlertCard extends StatelessWidget {
  const _PetAlertCard({required this.api, required this.report});

  final ApiClient api;
  final PetReport report;

  void _openDetail(BuildContext context, {bool focusSightingForm = false}) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PetDetailScreen(
          api: api,
          initialReport: report,
          focusSightingForm: focusSightingForm,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: HuellamiGOColors.paper,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: HuellamiGOColors.line),
        boxShadow: [
          BoxShadow(
            color: HuellamiGOColors.forest.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Stack(
          children: [
            Positioned(
              right: 0,
              top: 0,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: HuellamiGOColors.paper,
                  shape: BoxShape.circle,
                  border: Border.all(color: HuellamiGOColors.line),
                ),
                child: const Icon(
                  Icons.favorite_border,
                  color: Color(0x8A2B2B2B),
                  size: 20,
                ),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    PetThumbnail(
                      photoUrl: report.photoUrl,
                      size: 78,
                      borderRadius: 14,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(right: 30),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              report.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontFamily: HuellamiGOFonts.display,
                                color: HuellamiGOColors.navy,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(
                                  Icons.place,
                                  size: 16,
                                  color: HuellamiGOColors.sage,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    '${report.species} - ${report.zone}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  AppInfoPill(
                                    icon: Icons.schedule,
                                    label: report.lastSeenWhen,
                                    fontSize: 11,
                                  ),
                                  const SizedBox(width: 6),
                                  AppInfoPill(
                                    icon: Icons.flag,
                                    label: _statusLabel(report.status),
                                    fontSize: 11,
                                  ),
                                  if (report.reward.enabled) ...[
                                    const SizedBox(width: 6),
                                    _RewardPill(
                                      amount: report.reward.amount,
                                      currency: report.reward.currency,
                                      showAmount: report.reward.showAmount,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      flex: 5,
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                        onPressed: () =>
                            _openDetail(context, focusSightingForm: true),
                        icon: const Icon(Icons.visibility_outlined, size: 18),
                        label: const FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text('Lo vi'),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 6,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                        onPressed: () => _openDetail(context),
                        icon: const Icon(Icons.arrow_forward, size: 18),
                        label: const FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text('Detalle'),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _statusLabel(String status) {
    return switch (status) {
      'active' => 'Activa',
      'reunited' => 'Reunida',
      'archived' => 'Archivada',
      _ => status,
    };
  }
}

class _RewardPill extends StatelessWidget {
  const _RewardPill({
    required this.amount,
    required this.currency,
    required this.showAmount,
  });

  final double? amount;
  final String currency;
  final bool showAmount;

  @override
  Widget build(BuildContext context) {
    final amountValue = amount;
    final amountLabel = amountValue?.toStringAsFixed(
      amountValue.truncateToDouble() == amountValue ? 0 : 2,
    );
    final label = showAmount && amountLabel != null
        ? '\$$amountLabel $currency'
        : 'Recompensa';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFFFEEE6),
        border: Border.all(color: const Color(0xFFEAB9A7)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.paid, size: 14, color: HuellamiGOColors.forest),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w400),
          ),
        ],
      ),
    );
  }
}
