import type {
  AlbumInput,
  BulletinInput,
  ApiEnvelope,
  CompleteProfileInput,
  LoginInput,
  NewcomerSubmission,
  PostInput,
  SignupInput,
  UploadIssueInput,
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

/**
 * 요청 URL을 만든다.
 *
 * 브라우저에서는 상대 경로(`/api/...`)면 충분하다 — `next.config.ts`의
 * rewrites가 동일 출처로 프록시하므로 CORS도, 쿠키 설정도 필요 없다.
 *
 * ⚠️ **서버(SSR·정적 생성)에서는 상대 URL이 아예 동작하지 않는다.**
 *    Node의 `fetch`는 base가 없으면 `TypeError: Failed to parse URL`을 던진다.
 *    그래서 서버에서는 `API_ORIGIN`(서버 전용 환경변수 — `NEXT_PUBLIC_` 접두사를
 *    붙이지 않는다, NFR-SEC-22)으로 절대 URL을 만든다.
 *
 *    `API_ORIGIN`이 없으면 상대 경로를 그대로 두어 기존과 같은 에러를 낸다 —
 *    조용히 빈 값을 반환해 "데이터가 없는 것"처럼 보이게 하지 않는다.
 */
function buildUrl(path: string, qs: string): string {
  const rel = `/api${path}${qs ? `?${qs}` : ""}`;
  if (typeof window !== "undefined") return rel;

  const origin = process.env.API_ORIGIN;
  return origin ? `${origin.replace(/\/$/, "")}${rel}` : rel;
}

type RequestOptions = RequestInit & {
  query?: Record<string, string | number | undefined>;
  /**
   * `multipart/form-data` 전송 (첨부 업로드, SPEC_API §4.1).
   *
   * ⚠️ **값이 아니라 팩토리를 받는다.** 이유가 두 개다:
   *   ① `Content-Type`을 우리가 붙이면 안 된다 — boundary는 브라우저가
   *      생성한다. 그래서 이 옵션이 있을 때만 기본 JSON 헤더를 뺀다.
   *   ② `request()`는 401 후 리프레시하고 **같은 init으로 재시도**한다.
   *      body를 미리 만들어 넘기면 두 번째 fetch가 이미 소비된 body를
   *      보내게 된다. 시도마다 팩토리를 호출해 새 FormData를 만든다.
   */
  form?: () => FormData;
  /**
   * 업로드 진행률(0~100). **지정하면 `fetch` 대신 XHR로 보낸다** —
   * `fetch`는 업로드 진행률을 알려주지 않는다.
   *
   * 응답 해석(`{data}`/`{error}` 봉투)과 401 리프레시 재시도는 두 경로가
   * 똑같이 탄다. 달라지는 것은 "요청을 어떤 API로 보내는가" 하나뿐이다.
   */
  onUploadProgress?: (percent: number) => void;
};

/** 전송 수단이 무엇이든 여기까지 오면 같은 모양이다 */
type RawResponse = { status: number; text: string };

/**
 * XHR 전송 — 업로드 진행률이 필요할 때만 쓴다.
 *
 * `putToPresignedUrl`과 달리 **우리 서버로 가는 요청**이라 쿠키가 실려야 하고
 * 응답은 우리 규약(`{data}`/`{error}`)이다. 그래서 상태·본문만 그대로 돌려주고
 * 해석은 `rawRequest`가 fetch 경로와 동일하게 처리한다.
 */
function sendWithProgress(
  url: string,
  init: RequestInit,
  form: (() => FormData) | undefined,
  onUploadProgress: (percent: number) => void,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method ?? "GET", url, true);
    // 같은 출처면 기본으로 실리지만, 프록시 구성이 바뀌어도 흔들리지 않게 명시한다
    xhr.withCredentials = true;
    // multipart일 때 Content-Type을 우리가 붙이면 boundary가 빠진다 — 브라우저에 맡긴다
    if (!form) xhr.setRequestHeader("Content-Type", "application/json");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    // fetch가 네트워크 실패에 TypeError를 던지는 것과 같은 급으로 맞춘다
    // (규약 에러 코드 §1.2에 "전송 실패"가 없다)
    xhr.onerror = () => reject(new Error("네트워크 오류로 전송하지 못했습니다."));
    xhr.ontimeout = () => reject(new Error("전송 시간이 초과되었습니다."));

    xhr.send(form ? form() : ((init.body as XMLHttpRequestBodyInit | null) ?? null));
  });
}

/** 리프레시 재시도가 없는 순수 fetch 1회 */
async function rawRequest<T>(path: string, init?: RequestOptions): Promise<T> {
  const { query, form, onUploadProgress, ...rest } = init ?? {};

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined) search.set(k, String(v));
  }
  const url = buildUrl(path, search.toString());

  /*
    진행률을 요구할 때만 XHR로 간다. 서버(SSR)에는 XMLHttpRequest가 없으므로
    브라우저인지도 함께 본다 — 진행률을 볼 사람도 서버에는 없다.
  */
  const res: RawResponse =
    onUploadProgress && typeof window !== "undefined"
      ? await sendWithProgress(url, rest, form, onUploadProgress)
      : await (async () => {
          const r = await fetch(url, {
            ...rest,
            ...(form ? { body: form() } : null),
            // multipart일 때는 헤더를 비워 브라우저가 boundary까지 채운 값을 넣게 한다
            headers: form
              ? { ...rest.headers }
              : { "Content-Type": "application/json", ...rest.headers },
          });
          return { status: r.status, text: await r.text() };
        })();

  // 204는 본문이 없다 (logout·reset-request 등, SPEC_API §2) — 파싱을 시도하지 않는다
  if (res.status === 204 || res.text === "") {
    return undefined as T;
  }

  let body: ApiEnvelope<T>;
  try {
    body = JSON.parse(res.text) as ApiEnvelope<T>;
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
async function request<T>(path: string, init?: RequestOptions): Promise<T> {
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

/**
 * presigned URL로 객체 하나를 PUT한다 (SPEC_API §6.5 · ARCHITECTURE.md §7.3).
 *
 * ⚠️ **우리 서버가 아니라 R2로 직접 간다.** `request()`를 쓰지 않는 이유가 여럿이다:
 *   · 경로가 `/api/**`가 아니라 절대 URL이다 (프록시·쿠키·리프레시가 무관하다)
 *   · 응답이 우리 규약(`{data}`/`{error}`)이 아니다 — R2는 XML을 준다
 *   · **진행률이 필요하다.** `fetch`는 업로드 진행률을 알려주지 않아서 XHR을 쓴다.
 *     243장 업로드에서 진행률은 선택 사항이 아니다 (FR-PHO-08)
 *
 * 실패는 `ApiError`가 아니라 일반 `Error`다 — 규약 에러 코드(§1.2)에 전송 실패가
 * 없고, 화면은 이걸 "재시도 가능한 실패"로만 다룬다.
 */
function putToPresignedUrl(
  url: string,
  body: Blob,
  options?: { onProgress?: (percent: number) => void; signal?: AbortSignal },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (options?.signal?.aborted) {
      reject(new Error("업로드가 취소되었습니다."));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);

    /*
      Content-Type을 반드시 우리가 지정한다 — presigned 서명에 포함된 값과
      다르면 R2가 403을 준다. 리사이즈 결과는 항상 image/webp다.
      쿠키는 보내지 않는다(withCredentials 기본 false): 다른 출처이고, 인증은
      URL 서명에 이미 들어있다.
    */
    xhr.setRequestHeader("Content-Type", body.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options?.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    const onAbort = () => xhr.abort();
    options?.signal?.addEventListener("abort", onAbort, { once: true });
    const cleanup = () => options?.signal?.removeEventListener("abort", onAbort);

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      // 403은 대개 서명 만료(15분)다 — 재시도 시 URL을 재발급해야 한다
      reject(new Error(`전송에 실패했습니다 (${xhr.status}).`));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error("네트워크 오류로 전송하지 못했습니다."));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new Error("전송 시간이 초과되었습니다."));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new Error("업로드가 취소되었습니다."));
    };

    xhr.send(body);
  });
}

export const realApi: Api = {
  posts: {
    list: ({ category, page = 0, size = 20 }) =>
      request("/posts", { query: { category, page, size } }),
    get: (idOrSlug) => request(`/posts/${encodeURIComponent(idOrSlug)}`),
    create: (input: PostInput) =>
      request("/posts", { method: "POST", body: JSON.stringify(input) }),
    update: (id, input: PostInput) =>
      request(`/posts/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    remove: (id) => request(`/posts/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  attachments: {
    upload: (file) =>
      request("/attachments", {
        method: "POST",
        // 시도마다 새 FormData — 리프레시 재시도가 소비된 body를 보내지 않게 한다
        form: () => {
          const fd = new FormData();
          fd.append("file", file);
          return fd;
        },
      }),
    // 302 → presigned(10분) — 브라우저가 따라가야 한다 (SPEC_API §4.2)
    downloadUrl: (attachmentId) => `/api/files/${encodeURIComponent(attachmentId)}`,
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
    // ZIP 스트리밍 — fetch가 아니라 브라우저가 직접 이동한다 (SPEC_API §6.8)
    downloadUrl: (albumId, photoIds) =>
      `/api/albums/${encodeURIComponent(albumId)}/download?ids=${photoIds.join(",")}`,
    remove: (albumId) =>
      request(`/albums/${encodeURIComponent(albumId)}`, { method: "DELETE" }),
  },
  uploads: {
    issue: (input: UploadIssueInput) =>
      request("/uploads:issue", { method: "POST", body: JSON.stringify(input) }),
    put: putToPresignedUrl,
    commit: (photoIds) =>
      request("/uploads:commit", { method: "POST", body: JSON.stringify({ photoIds }) }),
  },
  photos: {
    report: (photoId, input) =>
      request(`/photos/${encodeURIComponent(photoId)}/report`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // 302 → presigned(attachment) — 브라우저가 따라가야 한다 (SPEC_API §6.7)
    downloadUrl: (photoId) => `/api/photos/${encodeURIComponent(photoId)}/download`,
    remove: (photoId) => request(`/photos/${encodeURIComponent(photoId)}`, { method: "DELETE" }),
  },
  meetings: {
    list: ({ page = 0, size = 20 } = {}) => request("/meetings", { query: { page, size } }),
    get: (id) => request(`/meetings/${encodeURIComponent(id)}`),
    // 서버가 워터마크를 합성해 스트리밍한다 — presigned URL이 아니다 (SPEC_API §7.3)
    pageUrl: (id, pageNo) =>
      `/api/meetings/${encodeURIComponent(id)}/pages/${encodeURIComponent(String(pageNo))}`,
    create: (input, options) =>
      request("/meetings", {
        method: "POST",
        onUploadProgress: options?.onUploadProgress,
        /*
          시도마다 새 FormData — 401 후 리프레시 재시도가 이미 소비된 body를
          보내지 않게 한다 (`bulletins.create`와 같은 이유).
        */
        form: () => {
          const fd = new FormData();
          fd.append("title", input.title);
          fd.append("meetingDate", input.meetingDate);
          fd.append("viewableFrom", input.viewableFrom);
          fd.append("viewableUntil", input.viewableUntil);
          // 파일명이 없으면 서버가 파트를 파일로 인식하지 못하는 구현이 있다
          fd.append("file", input.file, input.file.name || "meeting.pdf");
          return fd;
        },
      }),
    updateWindow: (id, input) =>
      request(`/meetings/${encodeURIComponent(id)}/window`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    remove: (id) => request(`/meetings/${encodeURIComponent(id)}`, { method: "DELETE" }),
    views: (id, { page = 0, size = 20 } = {}) =>
      request(`/meetings/${encodeURIComponent(id)}/views`, { query: { page, size } }),
  },
  admin: {
    members: ({ status, q, page = 0, size = 20 } = {}) =>
      request("/admin/members", { query: { status, q, page, size } }),
    approveMember: (id) =>
      request(`/admin/members/${encodeURIComponent(id)}/approve`, { method: "POST" }),
    rejectMember: (id, input) =>
      request(`/admin/members/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    changeRole: (id, input) =>
      request(`/admin/members/${encodeURIComponent(id)}/role`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    storage: () => request("/admin/storage"),
    newcomers: ({ page = 0, size = 20 } = {}) =>
      request("/admin/newcomers", { query: { page, size } }),
  },
  bulletins: {
    latest: () => request("/bulletins/latest"),
    list: ({ page = 0, size = 20 } = {}) => request("/bulletins", { query: { page, size } }),
    get: (id) => request(`/bulletins/${encodeURIComponent(id)}`),
    create: (input: BulletinInput) =>
      request("/bulletins", {
        method: "POST",
        /*
          시도마다 새 FormData — 401 후 리프레시 재시도가 이미 소비된 body를
          보내지 않게 한다 (`attachments.upload`와 같은 이유).
          ⚠️ append 순서가 곧 페이지 순서다 (SPEC_API §5.4).
        */
        form: () => {
          const fd = new FormData();
          fd.append("serviceDate", input.serviceDate);
          input.pages.forEach((page, index) => {
            // 파일명이 없으면 서버가 파트를 파일로 인식하지 못하는 구현이 있다
            fd.append("pages", page, `page-${index + 1}.webp`);
          });
          return fd;
        },
      }),
    remove: (id) => request(`/bulletins/${encodeURIComponent(id)}`, { method: "DELETE" }),
    // [CONTRACT] 신규 제안 경로 — 백엔드가 다르게 정하면 여기만 바꾼다
    downloadUrl: (id, pageNo) =>
      `/api/bulletins/${encodeURIComponent(id)}/pages/${encodeURIComponent(String(pageNo))}/download`,
  },
  capabilities: {
    zipDownload: true,
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
