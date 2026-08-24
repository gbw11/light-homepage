import type {
  AlbumInput,
  ApiEnvelope,
  CompleteProfileInput,
  LoginInput,
  NewcomerSubmission,
  SignupInput,
} from "@/types/api";
import { ApiError } from "./error";
import { notifySessionExpired } from "./session";
import type { Api } from "./types";

/**
 * 실제 백엔드 호출. **직접 import하지 않는다** — `@/lib/api`(index)만 쓴다.
 *
 * 동일 출처(`/api/**` → next.config.ts rewrites)라서
 *   · CORS 설정이 필요 없고
 *   · 쿠키는 기본값으로 실려간다 (credentials 'same-origin')
 * FE는 JWT를 직접 다루지 않는다 (SPEC_API §1.4).
 */

/**
 * 401을 만나도 리프레시를 시도하면 **안 되는** 경로 (SPEC_API §12.2).
 *
 * · `/auth/refresh` — 자기 자신을 재귀 호출하게 된다
 * · `/auth/login`   — 여기서의 401은 "토큰 만료"가 아니라 **비밀번호가 틀림**이다.
 *                     리프레시를 시도하면 무의미한 요청이 늘고, 원래 에러가 가려진다
 */
const NO_REFRESH_PATHS = ["/auth/refresh", "/auth/login"];

/**
 * 진행 중인 리프레시 요청 (single-flight).
 *
 * ⚠️ 리프레시 토큰은 **사용 시 회전**한다 (SPEC_API §2.3). 동시에 터진 401 3개가
 * 각각 리프레시를 보내면, 두 번째·세 번째는 이미 폐기된 토큰을 쓰게 되어
 * 멀쩡한 세션이 끊긴다. 그래서 동시 요청은 하나의 프로미스를 공유한다.
 */
let refreshInFlight: Promise<void> | null = null;

function refreshOnce(): Promise<void> {
  refreshInFlight ??= (async () => {
    try {
      await rawRequest<{ refreshed: boolean }>("/auth/refresh", { method: "POST" });
    } finally {
      // 성공이든 실패든 비워야 다음 만료 때 다시 시도할 수 있다
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** 리프레시 재시도가 없는 순수 fetch 1회 */
async function rawRequest<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> },
): Promise<T> {
  const { query, ...rest } = init ?? {};

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined) search.set(k, String(v));
  }
  const qs = search.toString();

  const res = await fetch(`/api${path}${qs ? `?${qs}` : ""}`, {
    ...rest,
    headers: { "Content-Type": "application/json", ...rest.headers },
  });

  // 204는 본문이 없다 (logout·reset-request 등, SPEC_API §2) — json() 파싱을 시도하지 않는다
  if (res.status === 204) {
    return undefined as T;
  }

  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // 규약을 벗어난 응답 (프록시 실패·502 HTML 등)
    throw new ApiError({
      code: "NOT_FOUND",
      message: `서버 응답을 해석할 수 없습니다 (${res.status})`,
      status: res.status,
    });
  }

  if ("error" in body) {
    throw new ApiError({ ...body.error, status: res.status });
  }
  return body.data;
}

/**
 * 401 처리 흐름 (SPEC_API §12.2):
 *
 *   API 401 → POST /auth/refresh **1회** 시도
 *     성공 → 원래 요청 재시도
 *     실패 → 세션 만료를 알린다 (→ AuthProvider가 상태를 비우고 화면이 /login으로)
 *
 * 재시도는 **정확히 1회**다. 재시도한 요청이 또 401이면 그대로 던진다.
 */
async function request<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> },
): Promise<T> {
  try {
    return await rawRequest<T>(path, init);
  } catch (error) {
    const isUnauthorized =
      error instanceof ApiError && error.code === "UNAUTHORIZED";

    if (!isUnauthorized || NO_REFRESH_PATHS.includes(path)) {
      throw error;
    }

    try {
      await refreshOnce();
    } catch {
      // 리프레시도 실패 → 더는 살릴 수 없는 세션이다
      notifySessionExpired();
      throw error; // 원래의 401을 그대로 전달한다 (호출부가 분기에 쓴다)
    }

    // 리프레시 성공 → 원래 요청을 한 번만 재시도
    return await rawRequest<T>(path, init);
  }
}

export const realApi: Api = {
  posts: {
    list: ({ category, page = 0, size = 20 }) =>
      request("/posts", { query: { category, page, size } }),
    get: (idOrSlug) => request(`/posts/${encodeURIComponent(idOrSlug)}`),
  },
  newcomers: {
    submit: (input: NewcomerSubmission) =>
      request("/newcomers", { method: "POST", body: JSON.stringify(input) }),
  },
  albums: {
    list: ({ page = 0, size = 20 } = {}) => request("/albums", { query: { page, size } }),
    create: (input: AlbumInput) =>
      request("/albums", { method: "POST", body: JSON.stringify(input) }),
    photos: (albumId, { cursor, size = 20 } = {}) =>
      request(`/albums/${encodeURIComponent(albumId)}/photos`, { query: { cursor, size } }),
  },
  photos: {
    report: (photoId, input) =>
      request(`/photos/${encodeURIComponent(photoId)}/report`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },
  auth: {
    signup: (input: SignupInput) =>
      request("/auth/signup", { method: "POST", body: JSON.stringify(input) }),
    login: (input: LoginInput) =>
      request("/auth/login", { method: "POST", body: JSON.stringify(input) }),
    logout: () => request("/auth/logout", { method: "POST" }),
    refresh: () => request("/auth/refresh", { method: "POST" }),
    me: () => request("/auth/me"),
    completeProfile: (input: CompleteProfileInput) =>
      request("/auth/complete-profile", { method: "POST", body: JSON.stringify(input) }),
    passwordResetRequest: (input) =>
      request("/auth/password/reset-request", { method: "POST", body: JSON.stringify(input) }),
    passwordResetConfirm: (input) =>
      request("/auth/password/reset", { method: "POST", body: JSON.stringify(input) }),
    updateProfile: (input) => request("/auth/me", { method: "PATCH", body: JSON.stringify(input) }),
    changePassword: (input) =>
      request("/auth/password/change", { method: "POST", body: JSON.stringify(input) }),
    deleteAccount: (input) => request("/auth/me", { method: "DELETE", body: JSON.stringify(input) }),
  },
};
