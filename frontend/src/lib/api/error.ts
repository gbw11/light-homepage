import type { ErrorCode } from "@/types/api";

/**
 * 백엔드 규약 에러를 그대로 담는 예외.
 * 화면은 `err.code`로 분기한다 (SPEC_API §1.2).
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly field: string | null;
  readonly status: number;

  constructor(args: {
    code: ErrorCode;
    message: string;
    field?: string | null;
    status?: number;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.code = args.code;
    this.field = args.field ?? null;
    this.status = args.status ?? 0;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/**
 * 서버에 닿지 못했거나, 닿았어도 규약(`{ data }`/`{ error }`) 밖의 응답이 온 경우.
 *
 * 프록시가 대신 돌려준 502/503/504 HTML, 빈 5xx 본문, 연결 거부(fetch TypeError)가
 * 여기에 든다. 서버는 06~24시에만 돈다(2026-08-27) — 새벽에는 이게 정상 경로다.
 *
 * ⚠️ 전에는 이 경우를 `ApiError("NOT_FOUND")`로 바꿨다. 그래서 백엔드가 꺼져
 * 있으면 **있는 공지가 "찾을 수 없는 글"로 나왔다** (점검 🟠-15). 없는 것과 못
 * 가져온 것은 다르다 — 화면은 이 예외를 보면 "잠시 후 다시"를 안내한다
 * (FR-PUB-10).
 *
 * `ApiError`가 아니다. `ErrorCode`는 백엔드 계약(SPEC_API §1.2)이라 FE가 임의로
 * 코드를 늘리지 않는다 — 기존 `isApiError` 분기는 이 예외를 건드리지 않는다.
 */
export class ServerUnavailableError extends Error {
  readonly status: number;

  constructor(status = 0) {
    super("서버에 잠시 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    this.name = "ServerUnavailableError";
    this.status = status;
  }
}

export function isServerUnavailable(e: unknown): e is ServerUnavailableError {
  return e instanceof ServerUnavailableError;
}
