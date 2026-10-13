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

/// 인트로 전체 길이. 엠블럼 → 글귀가 한 글자씩 써진다 → 잠깐 머문 뒤 사라진다
const introDuration = Duration(milliseconds: 2600);

/// 글귀를 쓰는 구간 (전체 길이에 대한 비율). 엠블럼이 다 뜨기 전에 바로 쓰기 시작한다
/// (PM 요청 2026-10-13 — 엠블럼과 글귀 사이 공백이 길게 느껴짐)
const _typingStart = 0.1;
const _typingEnd = 0.66;

/// 줄을 바꿀 때 몇 글자만큼 쉬는지 — 손으로 쓰듯 줄 사이에 잠깐 멈춘다
const _lineBreakPause = 2;

/// 다 쓴 뒤 커서가 깜빡이는 간격
const _caretBlink = Duration(milliseconds: 400);

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

  /// 쓰는 동안은 계속 보이고, 다 쓴 뒤에는 깜빡인다. 쓰기 전에는 숨긴다
  bool _caretVisible(double typing) {
    if (typing <= 0) return false;
    if (typing < 1) return true;
    final sinceDone =
        (_controller.value - _typingEnd) * introDuration.inMilliseconds;
    return (sinceDone / _caretBlink.inMilliseconds).floor().isEven;
  }

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
    // 쓴 글자 수 (줄바꿈 쉼 포함, 소수점 = 지금 쓰는 글자가 나타난 정도)
    final typing = _reduced
        ? const AlwaysStoppedAnimation<double>(1)
        : CurvedAnimation(
            parent: _controller,
            curve: const Interval(_typingStart, _typingEnd),
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
                        animation: typing,
                        builder: (context, _) => _TypedAcrostic(
                          typed: typing.value * _typingUnits,
                          showCaret: !_reduced && _caretVisible(typing.value),
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

/// 글귀 전체를 쓰는 데 드는 단위 (글자 수 + 줄바꿈 쉼)
final int _typingUnits =
    _acrostic.fold<int>(
      0,
      (sum, line) => sum + line.$1.length + line.$2.length,
    ) +
    (_acrostic.length - 1) * _lineBreakPause;

/// LIGHT 글귀를 [typed] 단위만큼 써 둔 모습.
///
/// 아직 안 쓴 글자도 **투명하게 자리를 차지**한다 — 글자가 늘 때마다 줄 폭이 바뀌면
/// 가운데 정렬된 글귀 묶음이 좌우로 흔들리기 때문이다. 지금 쓰는 글자는 [typed]의
/// 소수 부분만큼 흐릿하게 나타나서, 펜으로 쓰는 것처럼 부드럽게 이어진다.
class _TypedAcrostic extends StatelessWidget {
  const _TypedAcrostic({
    required this.typed,
    required this.showCaret,
    required this.style,
    required this.letterColor,
  });

  final double typed;
  final bool showCaret;
  final TextStyle style;
  final Color letterColor;

  @override
  Widget build(BuildContext context) {
    final lines = <Widget>[];
    var start = 0;
    for (var i = 0; i < _acrostic.length; i++) {
      final (letter, rest) = _acrostic[i];
      final length = letter.length + rest.length;
      final local = (typed - start).clamp(0.0, length.toDouble());
      final isLast = i == _acrostic.length - 1;
      // 커서는 지금 쓰고 있는 줄에 — 다 쓰면 마지막 줄 끝에 남는다
      final writingHere =
          typed >= start &&
          (typed < start + length + (isLast ? 1 : _lineBreakPause) || isLast);
      lines.add(
        _TypedLine(
          letter: letter,
          rest: rest,
          typed: local,
          caret: showCaret && writingHere,
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

/// 글귀 한 줄 — 첫 글자는 강조색, 나머지는 본문색
class _TypedLine extends StatelessWidget {
  const _TypedLine({
    required this.letter,
    required this.rest,
    required this.typed,
    required this.caret,
    required this.style,
    required this.letterColor,
  });

  final String letter;
  final String rest;
  final double typed;
  final bool caret;
  final TextStyle style;
  final Color letterColor;

  @override
  Widget build(BuildContext context) {
    final text = letter + rest;
    final whole = typed.floor();
    final caretAt = typed.ceil();
    final spans = <InlineSpan>[];
    for (var i = 0; i < text.length; i++) {
      if (caret && i == caretAt) spans.add(_caret());
      final shown = i < whole ? 1.0 : (i == whole ? typed - whole : 0.0);
      final base = i < letter.length
          ? letterColor
          : (style.color ?? Colors.black);
      spans.add(
        TextSpan(
          text: text[i],
          style: TextStyle(color: base.withValues(alpha: base.a * shown)),
        ),
      );
    }
    if (caret && caretAt >= text.length) spans.add(_caret());
    return Text.rich(TextSpan(style: style, children: spans));
  }

  /// 폭이 0인 커서 — 자리를 차지하지 않아 글자 위치가 흔들리지 않는다
  WidgetSpan _caret() => WidgetSpan(
    alignment: PlaceholderAlignment.middle,
    child: SizedBox(
      width: 0,
      height: (style.fontSize ?? 24) * 1.1,
      child: OverflowBox(
        maxWidth: 3,
        alignment: Alignment.centerLeft,
        child: ColoredBox(
          color: letterColor,
          child: const SizedBox(width: 2.5, height: double.infinity),
        ),
      ),
    ),
  );
}
