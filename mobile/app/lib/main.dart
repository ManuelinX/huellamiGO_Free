import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'models/pet_report.dart';
import 'models/user_profile.dart';
import 'screens/community_screen.dart';
import 'screens/home_screen.dart';
import 'screens/manage_report_screen.dart';
import 'screens/map_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/password_reset_screen.dart';
import 'screens/pet_detail_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/report_screen.dart';
import 'services/deep_links.dart';
import 'services/push_notifications.dart';
import 'widgets/huellamigo_ui.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  runApp(const HuellamiGOMobileApp());
}

class HuellamiGOMobileApp extends StatelessWidget {
  const HuellamiGOMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HuellamiGO',
      theme: buildHuellamiGOTheme(),
      home: const AppShell(),
    );
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _tabIndex = 0;
  final ApiClient _api = ApiClient();
  final DeepLinkService _deepLinkService = DeepLinkService();
  final PushNotificationService _pushNotificationService =
      PushNotificationService();
  UserProfile? _currentUser;
  bool _sessionLoading = true;
  String? _sessionMessage;
  int _unreadNotificationsCount = 0;
  StreamSubscription<String>? _deepLinkSubscription;
  String? _lastResetToken;
  Map<String, dynamic>? _pendingPushData;

  @override
  void initState() {
    super.initState();
    _loadSession();
    _listenForDeepLinks();
    _configurePushNotifications();
  }

  @override
  void dispose() {
    _deepLinkSubscription?.cancel();
    _pushNotificationService.dispose();
    super.dispose();
  }

  Future<void> _configurePushNotifications() async {
    await _pushNotificationService.configure(
      api: _api,
      onForegroundMessage: _loadUnreadNotificationsCount,
      onMessageOpened: _handlePushNotificationOpened,
    );
  }

  Future<void> _listenForDeepLinks() async {
    _deepLinkSubscription = _deepLinkService.links.listen(
      _handleDeepLink,
      onError: (_) {},
    );

    final initialLink = await _deepLinkService.getInitialLink();
    if (mounted && initialLink != null) {
      _handleDeepLink(initialLink);
    }
  }

  void _handleDeepLink(String link) {
    final resetToken = getPasswordResetTokenFromLink(link);

    if (resetToken == null || resetToken == _lastResetToken) {
      return;
    }

    _lastResetToken = resetToken;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => PasswordResetScreen(
            api: _api,
            token: resetToken,
            onCompleted: _handleLogin,
          ),
        ),
      );
    });
  }

  Future<void> _loadSession() async {
    setState(() {
      _sessionLoading = true;
      _sessionMessage = null;
    });

    try {
      final token = await _api.getAuthToken();
      if (token == null || token.isEmpty) {
        setState(() {
          _currentUser = null;
          _sessionLoading = false;
        });
        return;
      }

      final user = await _api.getMe();
      setState(() {
        _currentUser = user;
        _sessionLoading = false;
      });
      _loadUnreadNotificationsCount();
      _activatePushNotifications();
      _openPendingPushNotification();
    } on ApiException catch (error) {
      setState(() {
        _currentUser = null;
        _sessionLoading = false;
        _sessionMessage = error.statusCode == 401
            ? 'Sesion vencida. Inicia sesion de nuevo.'
            : error.message;
        _unreadNotificationsCount = 0;
      });
    } catch (error) {
      setState(() {
        _currentUser = null;
        _sessionLoading = false;
        _sessionMessage = 'No se pudo cargar la sesion: $error';
        _unreadNotificationsCount = 0;
      });
    }
  }

  void _handleLogin(UserProfile user) {
    setState(() {
      _currentUser = user;
      _sessionMessage = null;
      _tabIndex = 4;
    });
    _loadUnreadNotificationsCount();
    _activatePushNotifications();
    _openPendingPushNotification();
  }

  Future<void> _logout() async {
    await _deactivatePushNotifications();
    await _api.clearAuthToken();
    setState(() {
      _currentUser = null;
      _sessionMessage = 'Sesion cerrada.';
      _tabIndex = 4;
      _unreadNotificationsCount = 0;
    });
  }

  Future<void> _activatePushNotifications() async {
    if (_currentUser == null) {
      return;
    }

    try {
      await _pushNotificationService.registerSignedInDevice(_api);
    } catch (_) {}
  }

  Future<void> _deactivatePushNotifications() async {
    if (_currentUser == null) {
      return;
    }

    try {
      await _pushNotificationService.unregisterCurrentDevice(_api);
    } catch (_) {}
  }

  void _handlePushNotificationOpened(RemoteMessage message) {
    _loadUnreadNotificationsCount();
    if (_currentUser == null) {
      _pendingPushData = message.data;
      return;
    }

    final data = message.data;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _openPushTarget(data);
      }
    });
  }

  void _openPendingPushNotification() {
    final data = _pendingPushData;
    if (data == null || _currentUser == null) {
      return;
    }

    _pendingPushData = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _openPushTarget(data);
      }
    });
  }

  Future<void> _openPushTarget(Map<String, dynamic> data) async {
    if (_currentUser == null) {
      _pendingPushData = data;
      return;
    }

    final reportId = data['reportId']?.toString();
    if (reportId == null || reportId.isEmpty) {
      await _openNotifications();
      return;
    }

    final type = data['type']?.toString();
    final sightingId = data['sightingId']?.toString();
    if (type == 'nearby_sighting' ||
        (sightingId != null && sightingId.isNotEmpty)) {
      final openedManagement = await _openManagedReportFromPush(reportId);
      if (openedManagement) {
        return;
      }
    }

    await _openPublicReportFromPush(reportId, focusSightingForm: false);
  }

  Future<bool> _openManagedReportFromPush(String reportId) async {
    try {
      final reports = await _api.getMyReports();
      PetReport? ownedReport;
      for (final report in reports) {
        if (report.id == reportId) {
          ownedReport = report;
          break;
        }
      }

      if (ownedReport == null ||
          ownedReport.manageToken == null ||
          ownedReport.manageToken!.isEmpty) {
        return false;
      }
      final reportToManage = ownedReport;

      if (!mounted) {
        return true;
      }

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              ManageReportScreen(api: _api, initialReport: reportToManage),
        ),
      );
      _loadUnreadNotificationsCount();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _openPublicReportFromPush(
    String reportId, {
    required bool focusSightingForm,
  }) async {
    try {
      final report = await _api.getReport(reportId);
      if (!mounted) {
        return;
      }

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => PetDetailScreen(
            api: _api,
            initialReport: report,
            focusSightingForm: focusSightingForm,
          ),
        ),
      );
    } catch (_) {
      if (mounted) {
        await _openNotifications();
      }
    }
  }

  Future<void> _loadUnreadNotificationsCount() async {
    if (_currentUser == null) {
      if (mounted) {
        setState(() => _unreadNotificationsCount = 0);
      }
      return;
    }

    try {
      final count = await _api.getUnreadNotificationsCount();
      if (mounted) {
        setState(() => _unreadNotificationsCount = count);
      }
    } catch (_) {
      if (mounted) {
        setState(() => _unreadNotificationsCount = 0);
      }
    }
  }

  Future<void> _openNotifications() async {
    if (_currentUser == null) {
      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => NotificationsScreen(
          api: _api,
          onChanged: _loadUnreadNotificationsCount,
        ),
      ),
    );

    _loadUnreadNotificationsCount();
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      HomeScreen(api: _api, onSelectTab: _selectTab),
      MapScreen(api: _api),
      ReportScreen(
        api: _api,
        isSignedIn: _currentUser != null,
        emailVerified: _currentUser?.emailVerified ?? false,
        onLoginTap: () => _selectTab(4),
        onCreated: (_) => _selectTab(4),
      ),
      CommunityScreen(api: _api, onReportTap: () => _selectTab(2)),
      ProfileScreen(
        api: _api,
        user: _currentUser,
        loading: _sessionLoading,
        message: _sessionMessage,
        onLogin: _handleLogin,
        onLogout: _logout,
        onRefresh: _loadSession,
      ),
    ];
    const tabTitles = <String>[
      'Alertas',
      'Mapa',
      'Crear reporte',
      'Comunidad',
      'Perfil',
    ];
    const tabSubtitles = <String>[
      'Actividad cerca de ti',
      'Reportes activos',
      'Datos claros para ayudar',
      'Historias y red',
      'Cuenta y reportes',
    ];

    return Scaffold(
      body: SafeArea(
        child: HuellamiGOAppBackground(
          child: Column(
            children: [
              HuellamiGOHeader(
                title: tabTitles[_tabIndex],
                subtitle: tabSubtitles[_tabIndex],
                trailing: _currentUser == null
                    ? null
                    : _NotificationsHeaderButton(
                        unreadCount: _unreadNotificationsCount,
                        onTap: _openNotifications,
                      ),
              ),
              Expanded(child: pages[_tabIndex]),
            ],
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: _selectTab,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.pets), label: 'Alertas'),
          NavigationDestination(icon: Icon(Icons.map), label: 'Mapa'),
          NavigationDestination(icon: Icon(Icons.add_alert), label: 'Reportar'),
          NavigationDestination(icon: Icon(Icons.groups), label: 'Comunidad'),
          NavigationDestination(icon: Icon(Icons.person), label: 'Perfil'),
        ],
      ),
    );
  }

  void _selectTab(int index) {
    setState(() => _tabIndex = index);
  }
}

class _NotificationsHeaderButton extends StatelessWidget {
  const _NotificationsHeaderButton({
    required this.unreadCount,
    required this.onTap,
  });

  final int unreadCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton.filledTonal(
          onPressed: onTap,
          icon: const Icon(Icons.notifications_outlined),
          tooltip: 'Notificaciones',
        ),
        if (unreadCount > 0)
          Positioned(
            right: -2,
            top: -2,
            child: Container(
              constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: HuellamiGOColors.coral,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: HuellamiGOColors.paper, width: 1.5),
              ),
              child: Text(
                unreadCount > 9 ? '9+' : '$unreadCount',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  height: 1,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
