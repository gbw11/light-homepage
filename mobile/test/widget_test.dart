import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/main.dart';

import 'support/fake_server.dart';

void main() {
  testWidgets('앱이 뜨면 홈이 보인다', (tester) async {
    final server = FakeServer(
      (_) async => respond(200, {
        'data': {'items': [], 'page': 0, 'size': 3, 'hasNext': false},
      }),
    );

    await tester.pumpWidget(LightApp(api: clientFor(server)));
    await tester.pumpAndSettle();

    expect(find.text('LIGHT'), findsOneWidget);
    expect(find.text('주일 14:00 · 청년예배'), findsOneWidget);
  });
}
