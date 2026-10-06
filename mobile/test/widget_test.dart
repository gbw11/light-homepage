import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/main.dart';

void main() {
  testWidgets('앱이 뜬다', (tester) async {
    await tester.pumpWidget(const LightApp());

    expect(find.text('LIGHT'), findsOneWidget);
  });
}
