import '../../core/api/api_client.dart';

/// 성별 · 알게 된 경로의 선택지 (SPEC_API §9.1). 화면 문구는 웹
/// `welcome/register/RegisterForm.tsx`와 같다.
///
/// 나이대는 2026-10-19 생년월일(필수)로 바뀌었다 — 웹 폼은 아직 나이대다
typedef Choice = ({String wire, String label});

const genderChoices = <Choice>[
  (wire: 'MALE', label: '남'),
  (wire: 'FEMALE', label: '여'),
];

const referrerChoices = <Choice>[
  (wire: 'FRIEND', label: '지인 소개'),
  (wire: 'SEARCH', label: '검색'),
  (wire: 'SNS', label: 'SNS'),
  (wire: 'ETC', label: '기타'),
];

/// 새가족 등록 신청 (SPEC_API §9.1). 고르지 않은 칸은 null이고, 보낼 때 뺀다
typedef NewcomerSubmission = ({
  String name,
  String phone,

  /// `YYYY-MM-DD` — 필수
  String birthDate,
  String? gender,
  String? referrer,
  String? message,
});

/// 새가족 등록 API (SPEC_API §9.1, 권한 G)
class NewcomersApi {
  const NewcomersApi(this._client);

  final ApiClient _client;

  /// 같은 기기(IP)에서 5분에 5번을 넘기면 `RATE_LIMITED`다.
  /// 성공하면 전도사·임원 알림에 뜬다(SPEC_API §14) — **테스트로 실서버에 보내지 않는다**
  Future<String> submit(NewcomerSubmission s) => _client.post(
    '/newcomers',
    body: {
      'name': s.name,
      'phone': s.phone,
      'birthDate': s.birthDate,
      'gender': ?s.gender,
      'referrer': ?s.referrer,
      'message': ?s.message,
      // 동의 칸을 체크해야만 [등록하기]가 눌린다 — 그래서 여기는 늘 true다
      'agreed': true,
      // 웹 폼의 봇 덫(숨은 칸). 앱에는 숨은 칸이 없으니 늘 비워 보낸다
      'honeypot': '',
    },
    decode: (data) => (data as Map<String, dynamic>)['id'] as String,
  );
}
