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
