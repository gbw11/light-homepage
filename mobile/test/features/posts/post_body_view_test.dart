import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/posts/post_body_view.dart';

Map<String, dynamic> doc(List<Object> content) => {
  'type': 'doc',
  'content': content,
};

Map<String, dynamic> p(List<Object> inline) => {
  'type': 'paragraph',
  'content': inline,
};

Map<String, dynamic> t(String text, [List<Object> marks = const []]) => {
  'type': 'text',
  'text': text,
  'marks': marks,
};

Future<List<String>> pumpBody(
  WidgetTester tester,
  Map<String, dynamic> body,
) async {
  final opened = <String>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      home: Scaffold(
        body: SingleChildScrollView(
          child: PostBodyView(body: body, onOpenLink: opened.add),
        ),
      ),
    ),
  );
  return opened;
}

/// 글자 [text]를 담은 조각의 스타일
TextStyle? styleOf(WidgetTester tester, String text) {
  for (final rich in tester.widgetList<RichText>(find.byType(RichText))) {
    TextStyle? found;
    rich.text.visitChildren((span) {
      if (span is TextSpan && span.text == text) {
        found = span.style;
        return false;
      }
      return true;
    });
    if (found != null) return found;
  }
  return null;
}

void main() {
  testWidgets('문단 · 제목 · 목록 · 인용을 글자 그대로 그린다', (tester) async {
    await pumpBody(
      tester,
      doc([
        {
          'type': 'heading',
          'attrs': {'level': 2},
          'content': [t('수련회 안내')],
        },
        p([t('날짜: 10월 20일')]),
        {
          'type': 'bulletList',
          'content': [
            {
              'type': 'listItem',
              'content': [
                p([t('여권')]),
              ],
            },
            {
              'type': 'listItem',
              'content': [
                p([t('세면도구')]),
              ],
            },
          ],
        },
        {
          'type': 'orderedList',
          'attrs': {'start': 3},
          'content': [
            {
              'type': 'listItem',
              'content': [
                p([t('셋째')]),
              ],
            },
          ],
        },
        {
          'type': 'blockquote',
          'content': [
            p([t('인용문')]),
          ],
        },
        {'type': 'horizontalRule'},
      ]),
    );

    for (final text in ['수련회 안내', '날짜: 10월 20일', '여권', '세면도구', '셋째', '인용문']) {
      expect(find.textContaining(text, findRichText: true), findsOneWidget);
    }
    expect(find.text('•'), findsNWidgets(2));
    // 번호 목록은 start부터 센다
    expect(find.text('3.'), findsOneWidget);
    expect(find.byType(Divider), findsOneWidget);
  });

  testWidgets('굵게 · 기울임 · 밑줄 · 취소선을 입힌다', (tester) async {
    await pumpBody(
      tester,
      doc([
        p([
          t('굵게', [
            {'type': 'bold'},
          ]),
          t('기울임', [
            {'type': 'italic'},
          ]),
          t('밑줄취소', [
            {'type': 'underline'},
            {'type': 'strike'},
          ]),
        ]),
      ]),
    );

    expect(styleOf(tester, '굵게')?.fontWeight, FontWeight.w700);
    expect(styleOf(tester, '기울임')?.fontStyle, FontStyle.italic);
    final decoration = styleOf(tester, '밑줄취소')?.decoration;
    expect(decoration?.contains(TextDecoration.underline), isTrue);
    expect(decoration?.contains(TextDecoration.lineThrough), isTrue);
  });

  testWidgets('링크를 누르면 바깥에 연다', (tester) async {
    final opened = await pumpBody(
      tester,
      doc([
        p([
          t('신청서', [
            {
              'type': 'link',
              'attrs': {'href': 'https://forms.example.com/a'},
            },
          ]),
        ]),
      ]),
    );

    final span = find.byWidgetPredicate(
      (w) => w is RichText && w.text.toPlainText().contains('신청서'),
    );
    // 링크 조각의 recognizer를 직접 누른다 — 조각 하나뿐인 문단이다
    TapGestureRecognizer? recognizer;
    tester.widget<RichText>(span).text.visitChildren((s) {
      if (s is TextSpan && s.recognizer is TapGestureRecognizer) {
        recognizer = s.recognizer! as TapGestureRecognizer;
      }
      return true;
    });
    recognizer!.onTap!();

    expect(opened, ['https://forms.example.com/a']);
  });

  test('위험한 주소는 링크로 만들지 않는다', () {
    expect(safeLinkTarget('https://a.com'), 'https://a.com');
    expect(safeLinkTarget(' mailto:a@b.com '), 'mailto:a@b.com');
    expect(safeLinkTarget('tel:0553336321'), 'tel:0553336321');
    expect(safeLinkTarget('javascript:alert(1)'), isNull);
    expect(safeLinkTarget('data:text/html,x'), isNull);
    expect(safeLinkTarget('intent://x#Intent;end'), isNull);
    // 웹 상대 경로는 앱에 열 곳이 없다
    expect(safeLinkTarget('/news/1'), isNull);
    expect(safeLinkTarget(42), isNull);
  });

  testWidgets('모르는 노드도 안에 있는 글자는 살린다', (tester) async {
    await pumpBody(
      tester,
      doc([
        {
          'type': 'table',
          'content': [
            {
              'type': 'tableRow',
              'content': [
                {
                  'type': 'tableCell',
                  'content': [
                    p([t('표 안의 글자')]),
                  ],
                },
              ],
            },
          ],
        },
      ]),
    );

    expect(find.textContaining('표 안의 글자'), findsOneWidget);
  });

  testWidgets('모양이 틀린 값은 건너뛰고 나머지를 그린다', (tester) async {
    await pumpBody(tester, {
      'type': 'doc',
      'content': [
        'string',
        42,
        {'no': 'type'},
        p([t('살아남은 문단')]),
      ],
    });

    expect(tester.takeException(), isNull);
    expect(find.textContaining('살아남은 문단', findRichText: true), findsOneWidget);
  });

  testWidgets('본문이 비어 있어도 무너지지 않는다', (tester) async {
    await pumpBody(tester, const {});

    expect(tester.takeException(), isNull);
  });
}
