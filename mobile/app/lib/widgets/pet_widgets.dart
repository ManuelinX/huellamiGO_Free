import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'huellamigo_ui.dart';

class PetThumbnail extends StatelessWidget {
  const PetThumbnail({
    super.key,
    required this.photoUrl,
    this.size = 66,
    this.borderRadius = 12,
    this.icon = Icons.pets,
  });

  final String? photoUrl;
  final double size;
  final double borderRadius;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: SizedBox(
        width: size,
        height: size,
        child: CachedAppImage(
          imageUrl: photoUrl,
          width: size,
          height: size,
          fit: BoxFit.cover,
          icon: icon,
          cacheWidth: size,
          cacheHeight: size,
          backgroundColor: HuellamiGOColors.forest,
          iconColor: HuellamiGOColors.paper,
        ),
      ),
    );
  }
}

class CachedAppImage extends StatelessWidget {
  const CachedAppImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.cacheWidth,
    this.cacheHeight,
    this.fit = BoxFit.cover,
    this.icon = Icons.pets,
    this.iconSize,
    this.backgroundColor = HuellamiGOColors.mint,
    this.iconColor = HuellamiGOColors.forest,
  });

  final String? imageUrl;
  final double? width;
  final double? height;
  final double? cacheWidth;
  final double? cacheHeight;
  final BoxFit fit;
  final IconData icon;
  final double? iconSize;
  final Color backgroundColor;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl;
    final placeholder = ColoredBox(
      color: backgroundColor,
      child: Center(
        child: Icon(icon, color: iconColor, size: iconSize),
      ),
    );

    if (url == null || url.isEmpty) {
      return SizedBox(width: width, height: height, child: placeholder);
    }

    final dpr = MediaQuery.devicePixelRatioOf(
      context,
    ).clamp(1.0, 3.0).toDouble();
    final memCacheWidth = _cachePixels(cacheWidth ?? width, dpr);
    final memCacheHeight = _cachePixels(cacheHeight ?? height, dpr);

    return CachedNetworkImage(
      imageUrl: url,
      width: width,
      height: height,
      fit: fit,
      memCacheWidth: memCacheWidth,
      memCacheHeight: memCacheHeight,
      maxWidthDiskCache: memCacheWidth,
      maxHeightDiskCache: memCacheHeight,
      fadeInDuration: const Duration(milliseconds: 120),
      placeholder: (_, _) => placeholder,
      errorWidget: (_, _, _) => placeholder,
    );
  }

  int? _cachePixels(double? logicalSize, double dpr) {
    if (logicalSize == null || logicalSize <= 0) return null;
    return (logicalSize * dpr).ceil();
  }
}

class AppInfoPill extends StatelessWidget {
  const AppInfoPill({
    super.key,
    required this.icon,
    required this.label,
    this.fontSize = 12,
  });

  final IconData icon;
  final String label;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: HuellamiGOColors.mint,
        border: Border.all(color: HuellamiGOColors.line),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: HuellamiGOColors.forest),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              label,
              style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w400),
            ),
          ),
        ],
      ),
    );
  }
}
