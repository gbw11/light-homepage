/// 백엔드 규약 에러 코드 (SPEC_API §1.2).
///
/// 화면이 분기하는 값은 앞의 6개뿐이다. [internalError]·[rateLimited]는
/// 공통 안내 문구만 띄우고 분기하지 않는다.
enum ErrorCode {
  unauthorized('UNAUTHORIZED'),
  forbidden('FORBIDDEN'),
  notFound('NOT_FOUND'),
  validationError('VALIDATION_ERROR'),
  storageLimit('STORAGE_LIMIT'),
  duplicate('DUPLICATE'),
  internalError('INTERNAL_ERROR'),
  rateLimited('RATE_LIMITED'),

  /// 집합 밖의 값. 서버가 새 코드를 추가했는데 앱이 아직 모르는 경우다
  unknown('UNKNOWN');

  const ErrorCode(this.wire);

  /// 서버가 보내는 문자열 그대로의 값
  final String wire;

  static ErrorCode parse(String? raw) => ErrorCode.values.firstWhere(
    (code) => code.wire == raw,
    orElse: () => ErrorCode.unknown,
  );
}

/// 백엔드 규약 에러를 그대로 담는 예외 (웹의 `lib/api/error.ts`와 같은 역할).
/// 화면은 [code]로 분기한다.
class ApiError implements Exception {
  const ApiError({
    required this.code,
    required this.message,
    this.field,
    this.status = 0,
  });

  final ErrorCode code;
  final String message;

  /// `VALIDATION_ERROR`·`DUPLICATE`일 때 문제가 된 필드명
  final String? field;

  /// HTTP 상태 코드
  final int status;

  @override
  String toString() => 'ApiError(${code.wire}, $status): $message';
}
