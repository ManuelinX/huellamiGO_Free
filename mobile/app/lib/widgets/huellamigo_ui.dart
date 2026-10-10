import 'package:flutter/material.dart';

class HuellamiGOColors {
  static const terracotta = Color(0xFFE07A5F);
  static const coral = terracotta;
  static const gold = Color(0xFFF2B705);
  static const softYellow = Color(0xFFF2CC8F);
  static const sage = Color(0xFF81B29A);
  static const navy = Color(0xFF3D405B);
  static const cream = Color(0xFFF4F1DE);
  static const forest = Color(0xFF214E45);
  static const graphite = Color(0xFF2B2B2B);
  static const paper = Color(0xFFFFFAF0);
  static const mint = Color(0xFFEAF3EE);
  static const line = Color(0x29214E45);
}

class HuellamiGOAssets {
  static const menuLogo = 'assets/branding/menu-logo.png';
  static const logo = 'assets/branding/logo.png';
  static const petFrame = 'assets/resources/frame_image_pet.png';
  static const privateReportPresentation =
      'assets/resources/presentation_private_report.png';
  static const markerLostCoral = 'assets/maps/public/lost-coral.webp';
  static const markerReportNavy = 'assets/maps/public/report-navy.webp';
  static const markerRecentGold = 'assets/maps/public/recent-gold.webp';
  static const markerSeenSage = 'assets/maps/public/seen-sage.webp';
}

class HuellamiGOFonts {
  static const body = 'Poppins';
  static const title = 'Manrope';
  static const display = 'Nunito Sans';
}

ThemeData buildHuellamiGOTheme() {
  final colorScheme =
      ColorScheme.fromSeed(
        seedColor: HuellamiGOColors.forest,
        brightness: Brightness.light,
      ).copyWith(
        primary: HuellamiGOColors.forest,
        onPrimary: Colors.white,
        primaryContainer: HuellamiGOColors.mint,
        onPrimaryContainer: HuellamiGOColors.forest,
        secondary: HuellamiGOColors.sage,
        onSecondary: Colors.white,
        secondaryContainer: const Color(0xFFDDECE4),
        onSecondaryContainer: HuellamiGOColors.forest,
        tertiary: HuellamiGOColors.coral,
        onTertiary: Colors.white,
        surface: HuellamiGOColors.paper,
        surfaceContainerHighest: HuellamiGOColors.mint,
        outline: HuellamiGOColors.line,
        outlineVariant: HuellamiGOColors.line,
      );

  const textColor = HuellamiGOColors.graphite;
  const titleColor = HuellamiGOColors.forest;

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: HuellamiGOColors.cream,
    fontFamily: HuellamiGOFonts.body,
    textTheme: const TextTheme(
      headlineSmall: TextStyle(
        fontFamily: HuellamiGOFonts.display,
        color: titleColor,
        fontSize: 28,
        fontWeight: FontWeight.w900,
        height: 1.02,
      ),
      titleLarge: TextStyle(
        fontFamily: HuellamiGOFonts.title,
        color: titleColor,
        fontSize: 22,
        fontWeight: FontWeight.w800,
        height: 1.08,
      ),
      titleMedium: TextStyle(
        fontFamily: HuellamiGOFonts.title,
        color: titleColor,
        fontSize: 17,
        fontWeight: FontWeight.w800,
      ),
      titleSmall: TextStyle(
        fontFamily: HuellamiGOFonts.display,
        color: titleColor,
        fontSize: 14,
        fontWeight: FontWeight.w900,
      ),
      bodyLarge: TextStyle(
        color: textColor,
        fontWeight: FontWeight.w400,
        height: 1.46,
      ),
      bodyMedium: TextStyle(
        color: Color(0xB82B2B2B),
        fontWeight: FontWeight.w400,
        height: 1.46,
      ),
      bodySmall: TextStyle(
        color: Color(0xAD2B2B2B),
        fontWeight: FontWeight.w400,
        height: 1.38,
      ),
      labelLarge: TextStyle(fontWeight: FontWeight.w700),
    ),
    appBarTheme: const AppBarTheme(
      elevation: 0,
      centerTitle: false,
      backgroundColor: HuellamiGOColors.paper,
      foregroundColor: HuellamiGOColors.forest,
      titleTextStyle: TextStyle(
        fontFamily: HuellamiGOFonts.title,
        color: HuellamiGOColors.forest,
        fontSize: 20,
        fontWeight: FontWeight.w800,
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: HuellamiGOColors.paper,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: HuellamiGOColors.line),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: HuellamiGOColors.coral,
        foregroundColor: Colors.white,
        disabledBackgroundColor: HuellamiGOColors.coral.withValues(alpha: 0.42),
        disabledForegroundColor: Colors.white.withValues(alpha: 0.72),
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(
          fontFamily: HuellamiGOFonts.body,
          fontSize: 15,
          fontWeight: FontWeight.w800,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: HuellamiGOColors.forest,
        backgroundColor: HuellamiGOColors.paper,
        minimumSize: const Size(0, 46),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        side: const BorderSide(color: HuellamiGOColors.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(
          fontFamily: HuellamiGOFonts.body,
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: HuellamiGOColors.forest,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: HuellamiGOColors.mint,
      selectedColor: HuellamiGOColors.sage.withValues(alpha: 0.22),
      side: const BorderSide(color: HuellamiGOColors.line),
      labelStyle: const TextStyle(
        color: HuellamiGOColors.forest,
        fontWeight: FontWeight.w600,
      ),
      iconTheme: const IconThemeData(color: HuellamiGOColors.forest),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      labelStyle: const TextStyle(
        color: HuellamiGOColors.forest,
        fontWeight: FontWeight.w800,
      ),
      hintStyle: const TextStyle(color: Color(0x902B2B2B)),
      prefixIconColor: HuellamiGOColors.forest,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: HuellamiGOColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: HuellamiGOColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(
          color: HuellamiGOColors.forest,
          width: 1.4,
        ),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: HuellamiGOColors.coral),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: HuellamiGOColors.paper,
      indicatorColor: HuellamiGOColors.mint,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          color: states.contains(WidgetState.selected)
              ? HuellamiGOColors.forest
              : HuellamiGOColors.graphite.withValues(alpha: 0.68),
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w800
              : FontWeight.w500,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? HuellamiGOColors.forest
              : HuellamiGOColors.graphite.withValues(alpha: 0.58),
        ),
      ),
    ),
  );
}

class HuellamiGOAppBackground extends StatelessWidget {
  const HuellamiGOAppBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFFFBF2), HuellamiGOColors.cream],
        ),
      ),
      child: child,
    );
  }
}

class HuellamiGOHeader extends StatelessWidget {
  const HuellamiGOHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: HuellamiGOColors.paper.withValues(alpha: 0.96),
        border: Border.all(color: HuellamiGOColors.line),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(18)),
        boxShadow: [
          BoxShadow(
            color: HuellamiGOColors.forest.withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Image.asset(
            HuellamiGOAssets.menuLogo,
            width: 118,
            height: 44,
            fit: BoxFit.contain,
            alignment: Alignment.centerLeft,
          ),
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
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
        ],
      ),
    );
  }
}

class AppSectionPanel extends StatelessWidget {
  const AppSectionPanel({
    super.key,
    required this.number,
    required this.title,
    required this.children,
    this.subtitle,
  });

  final int number;
  final String title;
  final String? subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: HuellamiGOColors.paper,
        border: Border.all(color: HuellamiGOColors.line),
        borderRadius: BorderRadius.circular(14),
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
                width: 32,
                height: 32,
                decoration: const BoxDecoration(
                  color: HuellamiGOColors.navy,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '$number',
                    style: const TextStyle(
                      fontFamily: HuellamiGOFonts.display,
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
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

class AppEyebrow extends StatelessWidget {
  const AppEyebrow(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontFamily: HuellamiGOFonts.body,
        color: HuellamiGOColors.coral,
        fontSize: 12,
        fontWeight: FontWeight.w900,
      ),
    );
  }
}
