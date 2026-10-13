import 'dart:ui' as ui;

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

/// 인트로 전체 길이. 엠블럼 → 글귀를 펜으로 써 내려간다 → 잠깐 머문 뒤 사라진다
const introDuration = Duration(milliseconds: 2600);

/// 글귀를 쓰는 구간 (전체 길이에 대한 비율). 엠블럼이 다 뜨기 전에 바로 쓰기 시작한다
/// (PM 요청 2026-10-13 — 엠블럼과 글귀 사이 공백이 길게 느껴짐)
const _writingStart = 0.1;
const _writingEnd = 0.66;

/// 줄을 바꿀 때 몇 글자만큼 쉬는지 — 펜을 떼고 다음 줄로 옮기는 틈
const _lineBreakPause = 2;

/// 펜 끝에서 잉크가 번지는 폭(px) — 글자가 칸 단위로 툭툭 생기지 않고 이어져 나온다
const _inkEdge = 28.0;

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
    final logo = _phase(0, 0.12);
    // 글귀 전체를 쓴 정도 0→1 (펜이 일정한 빠르기로 움직이도록 직선)
    final writing = _reduced
        ? const AlwaysStoppedAnimation<double>(1)
        : CurvedAnimation(
            parent: _controller,
            curve: const Interval(_writingStart, _writingEnd),
          );
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
                      AnimatedBuilder(
                        animation: writing,
                        builder: (context, _) => _WrittenAcrostic(
                          written: writing.value * _writingUnits,
                          style: lineStyle,
                          letterColor: scheme.primary,
                        ),
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

/// 글귀 전체를 쓰는 데 드는 단위 (글자 수 + 줄바꿈 쉼). 줄마다 글자 수만큼
/// 시간을 받으므로 긴 줄은 오래, 짧은 줄은 짧게 — 펜 빠르기가 일정하다
final int _writingUnits =
    _acrostic.fold<int>(
      0,
      (sum, line) => sum + line.$1.length + line.$2.length,
    ) +
    (_acrostic.length - 1) * _lineBreakPause;

/// LIGHT 글귀를 [written] 단위만큼 써 둔 모습 — 위 줄부터 차례로
class _WrittenAcrostic extends StatelessWidget {
  const _WrittenAcrostic({
    required this.written,
    required this.style,
    required this.letterColor,
  });

  final double written;
  final TextStyle style;
  final Color letterColor;

  @override
  Widget build(BuildContext context) {
    final lines = <Widget>[];
    var start = 0;
    for (final (letter, rest) in _acrostic) {
      final length = letter.length + rest.length;
      lines.add(
        IntroPenLine(
          letter: letter,
          rest: rest,
          progress: ((written - start) / length).clamp(0.0, 1.0),
          style: style,
          letterColor: letterColor,
        ),
      );
      start += length + _lineBreakPause;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: lines,
    );
  }
}

/// 글귀 한 줄을 펜으로 쓰듯 왼쪽부터 이어서 드러낸다 (PM 요청 2026-10-13 —
/// 한 글자씩 툭툭 생기는 타자기 느낌 말고 펜으로 쓰는 느낌).
///
/// 펜 끝 자리는 [_inkEdge] 폭만큼 흐리게 번져서, 한 글자 안에서도 획이 조금씩
/// 나타난다. 줄 전체는 처음부터 자리를 차지하므로 글귀 묶음이 흔들리지 않는다.
/// 첫 글자는 강조색, 나머지는 본문색.
@visibleForTesting
class IntroPenLine extends StatelessWidget {
  const IntroPenLine({
    super.key,
    required this.letter,
    required this.rest,
    required this.progress,
    required this.style,
    required this.letterColor,
  });

  final String letter;
  final String rest;

  /// 이 줄을 쓴 정도 0(아직)→1(다 씀)
  final double progress;
  final TextStyle style;
  final Color letterColor;

  @override
  Widget build(BuildContext context) {
    final text = Text.rich(
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
    );
    if (progress >= 1) return text;
    if (progress <= 0) return Opacity(opacity: 0, child: text);
    // 사람 손처럼 쓰기 시작과 끝에서 살짝 느리다
    final eased = Curves.easeInOutSine.transform(progress);
    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (bounds) {
        // 번지는 폭까지 끝까지 지나가야 마지막 획이 다 진해진다
        final pen = bounds.left + eased * (bounds.width + _inkEdge);
        return ui.Gradient.linear(
          Offset(pen - _inkEdge, 0),
          Offset(pen, 0),
          const [Colors.white, Colors.transparent],
        );
      },
      child: text,
    );
  }
}
