import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../models/app_notification.dart';
import '../widgets/app_feedback.dart';
import '../widgets/huellamigo_ui.dart';
import '../widgets/screen_padding.dart';
import 'pet_detail_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, required this.api, this.onChanged});

  final ApiClient api;
  final VoidCallback? onChanged;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<List<AppNotification>> _future;
  List<AppNotification> _notifications = const <AppNotification>[];
  bool _markingAll = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _future = _loadNotifications();
  }

  Future<List<AppNotification>> _loadNotifications() async {
    final notifications = await widget.api.getNotifications();
    _notifications = notifications;
    return notifications;
  }

  Future<void> _refresh() async {
    setState(() {
      _message = null;
      _future = _loadNotifications();
    });
    await _future;
  }

  Future<void> _markAllAsRead() async {
    setState(() {
      _markingAll = true;
      _message = null;
    });

    try {
      await widget.api.markAllNotificationsAsRead();
      final now = DateTime.now().toIso8601String();
      setState(() {
        _notifications = _notifications
            .map(
              (notification) => notification.isUnread
                  ? notification.copyWith(readAt: now)
                  : notification,
            )
            .toList();
        _future = Future.value(_notifications);
        _message = 'Notificaciones marcadas como leidas.';
      });
      widget.onChanged?.call();
    } catch (error) {
      if (mounted) {
        setState(() => _message = 'Error: $error');
      }
    } finally {
      if (mounted) {
        setState(() => _markingAll = false);
      }
    }
  }

  Future<void> _openNotification(AppNotification notification) async {
    setState(() => _message = null);

    try {
      var nextNotification = notification;
      if (notification.isUnread) {
        nextNotification = await widget.api.markNotificationAsRead(
          notification.id,
        );
        setState(() {
          _notifications = _notifications
              .map(
                (item) =>
                    item.id == nextNotification.id ? nextNotification : item,
              )
              .toList();
          _future = Future.value(_notifications);
        });
        widget.onChanged?.call();
      }

      final reportId = nextNotification.targetReportId;
      if (reportId == null || reportId.isEmpty) {
        return;
      }

      final report = await widget.api.getReport(reportId);
      if (!mounted) {
        return;
      }

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => PetDetailScreen(
            api: widget.api,
            initialReport: report,
            focusSightingForm: nextNotification.type == 'nearby_sighting',
          ),
        ),
      );
    } catch (error) {
      if (mounted) {
        setState(() => _message = 'Error: $error');
      }
    }
  }

  int get _unreadCount {
    return _notifications.where((notification) => notification.isUnread).length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        actions: [
          IconButton(
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
            tooltip: 'Actualizar',
          ),
        ],
      ),
      body: HuellamiGOAppBackground(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: FutureBuilder<List<AppNotification>>(
            future: _future,
            builder: (context, snapshot) {
              final notifications = _notifications;

              if (snapshot.connectionState != ConnectionState.done &&
                  notifications.isEmpty) {
                return const AppLoadingState(
                  center: true,
                  title: 'Cargando notificaciones',
                  message: 'Buscando actividad reciente.',
                );
              }

              if (snapshot.hasError && notifications.isEmpty) {
                return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: scrollScreenPadding(context),
                  children: [
                    AppMessageState(
                      icon: Icons.cloud_off,
                      title: friendlyErrorTitle(
                        snapshot.error,
                        fallback: 'No se pudieron cargar tus notificaciones',
                      ),
                      message: friendlyErrorMessage(snapshot.error),
                      action: OutlinedButton.icon(
                        onPressed: _refresh,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Reintentar'),
                      ),
                    ),
                  ],
                );
              }

              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: scrollScreenPadding(context),
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _unreadCount == 0
                              ? 'Todo al dia'
                              : '$_unreadCount sin leer',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                      OutlinedButton.icon(
                        onPressed: _markingAll || _unreadCount == 0
                            ? null
                            : _markAllAsRead,
                        icon: _markingAll
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.done_all),
                        label: const Text('Leer todas'),
                      ),
                    ],
                  ),
                  if (_message != null) ...[
                    const SizedBox(height: 12),
                    AppInlineMessage(message: _message!),
                  ],
                  const SizedBox(height: 14),
                  if (notifications.isEmpty)
                    const AppMessageState(
                      icon: Icons.notifications_none,
                      title: 'Sin notificaciones',
                      message:
                          'Cuando haya actividad importante, aparecera aqui.',
                    )
                  else
                    ...notifications.map(
                      (notification) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _NotificationCard(
                          notification: notification,
                          onTap: () => _openNotification(notification),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final meta = [
      notification.zone,
      notification.statusLabel,
      _formatNotificationDate(notification.createdAt),
    ].whereType<String>().where((item) => item.isNotEmpty).join(' - ');

    return Card(
      elevation: 0,
      color: notification.isUnread ? HuellamiGOColors.mint : colors.surface,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: notification.isUnread
                      ? HuellamiGOColors.coral
                      : HuellamiGOColors.forest,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.notifications_active,
                  color: Colors.white,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                            ),
                          ),
                        ),
                        if (notification.isUnread)
                          const Icon(
                            Icons.circle,
                            size: 9,
                            color: HuellamiGOColors.coral,
                          ),
                      ],
                    ),
                    if (notification.body != null &&
                        notification.body!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        notification.body!,
                        style: theme.textTheme.bodyMedium,
                      ),
                    ],
                    if (meta.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        meta,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: HuellamiGOColors.forest,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatNotificationDate(String value) {
    final date = DateTime.tryParse(value);
    if (date == null) {
      return '';
    }

    final local = date.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$day/$month $hour:$minute';
  }
}
