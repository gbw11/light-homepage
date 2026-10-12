// 원본: frontend/src/content/contact.ts — 번호가 바뀌면 두 곳을 함께 고친다
// (기획안 결정 D6).

/// ⚠️ 청년교회 직통이 아니라 **모교회(김해교회) 대표번호**다 (PLAN §1.4).
/// 화면에 쓸 때는 "교회 사무실로 연결된다"는 안내를 함께 둔다
const churchPhone = '055-333-6321';

/// `tel:` 주소용 — 하이픈을 뺀 형태가 더 널리 동작한다
final churchPhoneTel = churchPhone.replaceAll('-', '');
