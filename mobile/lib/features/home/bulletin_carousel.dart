import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/format/date_format.dart';
import '../../core/ui/signed_image.dart';
import '../bulletins/bulletin.dart';

/// 장을 넘기는 간격
const bulletinRotateInterval = Duration(seconds: 2);

/// 홈 맨 위의 최신 주보 — 장(보통 2장)을 [bulletinRotateInterval]마다 넘긴다.
///
/// 손으로 넘겨도 되고, 누르면 주보 보기로 간다. 주보 보기는 새 주소를 받으니
/// 여기 주소가 만료돼도(10분) 누르면 열린다.
///
/// 스크린리더를 쓰거나 애니메이션을 끈 사람에게는 자동으로 넘기지 않는다 —
/// 저절로 바뀌는 화면은 읽는 도중에 내용이 사라진다.
class BulletinCarousel extends StatefulWidget {
  const BulletinCarousel({
    super.key,
    required this.bulletin,
    required this.onOpen,
  });

  final Bulletin bulletin;
  final VoidCallback onOpen;

  @override
  State<BulletinCarousel> createState() => _BulletinCarouselState();
}

class _BulletinCarouselState extends State<BulletinCarousel> {
  final _controller = PageController();
  Timer? _timer;
  var _index = 0;

  List<BulletinPage> get _pages => widget.bulletin.pages;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _restartTimer();
  }

  /// 손으로 넘기면 그 장을 다시 2초 보여준다 — 넘기자마자 저절로 넘어가지 않게
  void _restartTimer() {
    _timer?.cancel();
    final media = MediaQuery.of(context);
    if (_pages.length < 2 ||
        media.accessibleNavigation ||
        media.disableAnimations) {
      return;
    }
    _timer = Timer.periodic(bulletinRotateInterval, (_) {
      if (_controller.hasClients) {
        _controller.nextPage(
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final count = _pages.length;
    final date = formatYmd(widget.bulletin.serviceDate);
    return Semantics(
      container: true,
      button: true,
      label: '$date 주보 보기, $count장',
      // 안쪽 그림 · 글자를 가리면 누르기도 가려진다 — 여기서 다시 건다
      excludeSemantics: true,
      onTap: widget.onOpen,
      child: ColoredBox(
        color: scheme.surfaceContainer,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Listener(
              onPointerDown: (_) => _restartTimer(),
              child: PageView.builder(
                controller: _controller,
                // 끝없이 앞으로 넘긴다 — 마지막 장에서 첫 장으로 거꾸로 감기지 않게
                itemCount: count > 1 ? null : count,
                onPageChanged: (i) => setState(() => _index = i % count),
                itemBuilder: (context, i) => GestureDetector(
                  onTap: widget.onOpen,
                  child: SignedImage(
                    url: _pages[i % count].url,
                    // 한 장을 통째로 보여준다 — 주보는 잘리면 글이 잘린다
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),
            // 주보 글을 덜 가리게 작게 둔다. 같은 내용을 스크린리더 이름(위)이 읽어
            // 주니, 글씨를 키운 사람에게도 1.3배까지만 키운다
            Positioned(
              right: 8,
              bottom: 8,
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0x99000000),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    child: Text(
                      textScaler: MediaQuery.textScalerOf(context)
                          .clamp(maxScaleFactor: 1.3),
                      count > 1
                          ? '$date 주보 · ${_index + 1}/$count'
                          : '$date 주보',
                      style: Theme.of(context).textTheme.labelSmall
                          ?.copyWith(color: Colors.white),
                    ),
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

/// 주보 칸의 가로세로 비율. 장 크기를 알면 그 비율로 — 주보는 가로로 긴
/// 펼침면(약 1.4:1)이라 16:9 칸에 맞추면 양옆이 빈다. 다만 세로로 긴 주보가
/// 와도 예배 시간 · 버튼이 첫 화면 밖으로 밀리지 않게 4:3보다 높이지 않는다
double bulletinAspectRatio(Bulletin bulletin) {
  final first = bulletin.pages.firstOrNull;
  final (w, h) = (first?.width, first?.height);
  if (w == null || h == null || w <= 0 || h <= 0) return 16 / 9;
  return (w / h).clamp(4 / 3, 16 / 9);
}
