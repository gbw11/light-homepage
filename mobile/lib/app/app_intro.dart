import 'package:flutter/material.dart';

/// LIGHT의 뜻 — 웹 첫 화면(`frontend/src/app/_components/IntroGate.tsx`)과 같은 글귀
const _acrostic = <(String, String)>[
  ('L', 'ive'),
  ('I', 'n'),
  ('G', 'od'),
  ('H', 'elp'),
  ('T', 'he other'),
];

const _logoAsset = 'assets/images/logo.png';

/// 인트로 전체 길이. 엠블럼 → 글귀가 한 줄씩 → 잠깐 머문 뒤 사라진다
const introDuration = Duration(milliseconds: 2600);

/// 동작 줄이기를 켠 사람에게는 움직임 없이 짧게만 보여준다
const introReducedDuration = Duration(milliseconds: 900);

/// 건너뛸 때 남은 부분을 이 시간 안에 끝낸다
const _skipDuration = Duration(milliseconds: 250);

/// 앱을 켰을 때 처음 보이는 인트로 (PM 요청 2026-10-07).
///
/// 웹 첫 화면은 "누르면 펼쳐지고, 한 번 더 누르면 들어간다"는 2단계인데, 앱은
/// 켤 때마다 보이므로 두 번 누르게 하면 번거롭다. 그래서 **저절로 재생되고,
/// 누르면 바로 건너뛴다.** 시스템 스플래시(Android `values-v31/styles.xml`)와
/// 같은 크림 배경·엠블럼으로 이어져서 화면이 끊기지 않는다.
///
/// [child](라우터가 그리는 앱 본체)는 처음부터 **아래에서 함께 그려진다** — 인트로가
/// 도는 동안 홈이 공지·말씀을 미리 불러오므로, 인트로가 걷히면 바로 내용이 있다.
/// 인트로가 떠 있는 동안 아래 화면은 스크린리더에 읽히지 않게 가린다.
class AppIntro extends StatefulWidget {
  const AppIntro({super.key, required this.child});

  final Widget child;

  @override
  State<AppIntro> createState() => _AppIntroState();
}

class _AppIntroState extends State<AppIntro>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: introDuration)
        ..addStatusListener((status) {
          if (status == AnimationStatus.completed && mounted) {
            setState(() => _done = true);
          }
        });

  bool _done = false;
  bool _skipped = false;
  bool _started = false;
  bool _reduced = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    // MediaQuery는 initState에서 읽을 수 없다 — 첫 의존성 시점에 한 번만 정한다
    _reduced = MediaQuery.of(context).disableAnimations;
    if (_reduced) _controller.duration = introReducedDuration;
    // 엠블럼을 미리 디코드해 둔다 — 아니면 첫 몇 프레임에 그림 없이 글자만 지나간다
    precacheImage(const AssetImage(_logoAsset), context);
    _controller.forward();
    _restartWhenVisible();
  }

  /// 첫 화면이 **실제로 그려진 순간** 처음부터 다시 재생한다.
  ///
  /// debug 빌드나 느린 기기에서는 첫 프레임에 수 초가 걸린다(그동안 시스템 스플래시가
  /// 떠 있다). 애니메이션 시계는 그 사이에도 흘러서, 화면에 나타날 때는 이미 끝나
  /// 있었다 — 스플래시 다음에 인트로 없이 바로 홈이 떴다 (에뮬레이터 실측 2026-10-07).
  /// 첫 프레임이 빨리 그려지는 기기에서는 수십 ms를 되감을 뿐이라 차이가 없다.
  /// (테스트 환경에서는 이 신호가 오지 않으므로 그대로 재생된다)
  Future<void> _restartWhenVisible() async {
    await WidgetsBinding.instance.waitUntilFirstFrameRasterized;
    if (mounted && !_done && !_skipped) _controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _skip() {
    if (_done) return;
    _skipped = true;
    _controller.animateTo(1, duration: _skipDuration);
  }

  /// [begin]~[end] 구간에서 0→1. 동작 줄이기면 처음부터 1(마지막 퇴장만 남긴다)
  Animation<double> _phase(double begin, double end) => _reduced
      ? const AlwaysStoppedAnimation(1)
      : CurvedAnimation(
          parent: _controller,
          curve: Interval(begin, end, curve: Curves.easeOutCubic),
        );

  @override
  Widget build(BuildContext context) {
    if (_done) return widget.child;

    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    // 마지막 18%에 걸쳐 걷힌다. 동작 줄이기면 마지막 40%
    final exit = CurvedAnimation(
      parent: _controller,
      curve: Interval(_reduced ? 0.6 : 0.82, 1, curve: Curves.easeIn),
    );
    final logo = _phase(0, 0.2);
    final lineStyle = (textTheme.headlineSmall ?? const TextStyle()).copyWith(
      fontWeight: FontWeight.w700,
      height: 1.25,
      color: scheme.onSurface,
    );

    return Stack(
      fit: StackFit.expand,
      children: [
        ExcludeSemantics(child: widget.child),
        AnimatedBuilder(
          animation: exit,
          builder: (context, child) =>
              Opacity(opacity: 1 - exit.value, child: child),
          child: Semantics(
            button: true,
            label: 'LIGHT — 김해교회 청년교회. 누르면 건너뜁니다',
            excludeSemantics: true,
            child: GestureDetector(
              key: const Key('app-intro'),
              behavior: HitTestBehavior.opaque,
              onTap: _skip,
              child: ColoredBox(
                color: scheme.surface,
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      FadeTransition(
                        opacity: logo,
                        child: ScaleTransition(
                          scale: Tween(begin: 0.92, end: 1.0).animate(logo),
                          child: Image.asset(
                            _logoAsset,
                            height: 160,
                            // 시스템 스플래시에서 이어지는 그림이라 장식이다
                            excludeFromSemantics: true,
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          for (var i = 0; i < _acrostic.length; i++)
                            _AcrosticLine(
                              letter: _acrostic[i].$1,
                              rest: _acrostic[i].$2,
                              style: lineStyle,
                              letterColor: scheme.primary,
                              // 한 줄씩 차례로 — 0.20에서 시작해 0.07 간격
                              progress: _phase(0.2 + i * 0.07, 0.35 + i * 0.07),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// 글귀 한 줄 — 첫 글자는 강조색, 나머지는 본문색. 왼쪽에서 살짝 밀려 들어온다
class _AcrosticLine extends StatelessWidget {
  const _AcrosticLine({
    required this.letter,
    required this.rest,
    required this.style,
    required this.letterColor,
    required this.progress,
  });

  final String letter;
  final String rest;
  final TextStyle style;
  final Color letterColor;
  final Animation<double> progress;

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: progress,
      child: SlideTransition(
        position: Tween(
          begin: const Offset(-0.08, 0),
          end: Offset.zero,
        ).animate(progress),
        child: Text.rich(
          TextSpan(
            style: style,
            children: [
              TextSpan(
                text: letter,
                style: TextStyle(color: letterColor),
              ),
              TextSpan(text: rest),
            ],
          ),
        ),
      ),
    );
  }
}
