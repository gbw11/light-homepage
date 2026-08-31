/*
 * LIGHT PWA 서비스워커 — FR-MEM-03
 *
 * ⚠️ 이 파일은 보안 경계다. 수정하기 전에 아래를 읽는다.
 *
 * SPEC_FUNCTIONAL.md §3.1 FR-MEM-03 수용 기준:
 *   "PWA 서비스워커는 **회원 데이터를 캐싱하지 않는다.** 주보·사진·문서를
 *    캐싱하면 로그아웃 후에도 남는다. 캐시 대상은 정적 자산과 공개 페이지
 *    셸로 한정한다."
 * SPEC_NONFUNCTIONAL.md §14: "회원 편의(캐싱) ↔ 보안 → **보안 우선.**"
 *
 * 즉 로그아웃한 사람이나 공용 기기의 다음 사용자가 캐시에서 이전 회원의
 * 사진(얼굴이 식별되는 실제 인물)이나 주보를 꺼낼 수 있어서는 안 된다.
 *
 * 그래서 이 워커는 **화이트리스트만** 캐싱한다. "일단 다 캐싱하고 민감한 것만
 * 뺀다"는 방식(catch-all + 블랙리스트)을 쓰지 않는다 — 새 라우트가 추가될 때
 * 조용히 캐싱되는 쪽이 기본값이 되면 안 된다.
 *
 * 캐싱하는 것 (전부, 이게 목록의 끝이다):
 *   1. 빌드 정적 자산 `/_next/static/**` (해시 파일명, 불변)
 *   2. PWA 아이콘·매니페스트·파비콘
 *   3. 공개 라우트의 HTML 셸 (PUBLIC_ROUTE_PREFIXES)
 *   4. 오프라인 폴백 페이지 `/offline`
 *
 * 캐싱하지 않는 것:
 *   · `/my/**` `/admin/**` 과 자료 화면 전체(`/photos` `/bulletin` `/meetings`
 *     `/notices` `/documents`) — robots.ts·next.config.ts가 noindex로 표시하는
 *     민감 경로 목록과 같게 유지한다.
 *     ⚠️ 자료 화면은 공개 열람 전환(PM 결정 2026-08-25) 뒤에도 캐싱하지 않는다.
 *     "로그인 없이 볼 수 있다"와 "공용 기기에 남는다"는 다른 문제이고, PM이
 *     오프라인 캐싱을 하지 않는 쪽을 택했다
 *   · `/api/**` — 응답 전부 (회원 데이터 그 자체)
 *   · **`/_next/image` 전부** — 경로만 보면 `/_next/`로 시작해 "정적 자산"처럼
 *     보이지만, 사람 사진이 이 URL로 실려 나갈 수 있다. `/_next/`를 통째로
 *     화이트리스트에 넣지 않는 이유다. (앨범 커버는 presigned URL이라 지금은
 *     `<img>`로 직접 로드하지만, 이 방어선은 그대로 둔다 — 다음에 누가
 *     `next/image`를 쓰는 순간 조용히 캐싱되면 안 된다.)
 *     대가: 오프라인에서 공개 페이지의 이미지가 안 나온다. 스펙대로 보안 우선.
 *   · GET 이외 메서드, 다른 출처(cross-origin) 요청
 */

// 캐시 저장 방식이 바뀌면 반드시 올린다 — 이름이 바뀌어야 activate가 이전
// 캐시를 통째로 지운다. (v2: 내비게이션 캐시 키를 pathname으로 정규화)
const VERSION = "v2";
const STATIC_CACHE = `light-static-${VERSION}`;
const SHELL_CACHE = `light-shell-${VERSION}`;
const OWNED_CACHES = [STATIC_CACHE, SHELL_CACHE];

/** 오프라인 폴백 페이지 — 설치 시 미리 받아둔다 */
const OFFLINE_URL = "/offline";

/**
 * 민감 경로. `robots.ts`의 disallow 목록 + `/api`와 같게 유지한다.
 * 여기에 걸리면 캐시에 넣지도, 캐시에서 꺼내지도 않는다.
 */
const SENSITIVE_PREFIXES = [
  "/my",
  "/admin",
  "/photos",
  "/bulletin",
  "/bulletins",
  "/meetings",
  "/notices",
  "/documents",
  "/api",
];

/** HTML 셸을 캐싱해도 되는 공개 라우트 (app/sitemap.ts + 인증 진입 화면) */
const PUBLIC_ROUTE_PREFIXES = [
  "/",
  "/about",
  "/worship",
  "/sermons",
  "/news",
  "/location",
  "/welcome",
  "/home",
  "/login",
  "/signup",
  "/password",
  OFFLINE_URL,
];

/** 캐싱해도 되는 정적 자산 경로 접두사 */
const STATIC_PREFIXES = ["/_next/static/", "/icons/"];

/** 캐싱해도 되는 정적 자산 단일 경로 (쿼리스트링이 붙을 수 있다) */
const STATIC_PATHS = ["/manifest.webmanifest", "/favicon.ico", "/apple-icon.png"];

/** `/photos`가 `/photography` 같은 다른 라우트까지 잡지 않도록 세그먼트 단위로 본다 */
function matchesPrefix(pathname, prefix) {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isSensitive(pathname) {
  return SENSITIVE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function isPublicRoute(pathname) {
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function isCacheableStatic(pathname) {
  if (isSensitive(pathname)) return false;
  // ⚠️ `/_next/image`는 회원 사진을 실어 나른다 (파일 상단 주석 참고).
  //    `/_next/static/`만 허용하므로 `/_next/image`는 아래 어느 조건에도 걸리지 않는다.
  return (
    STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    STATIC_PATHS.includes(pathname)
  );
}

/** HTML 셸을 캐싱해도 되는 내비게이션인가 */
function isCacheableNavigation(pathname) {
  return !isSensitive(pathname) && isPublicRoute(pathname);
}

/**
 * 설치: 오프라인 폴백과 아이콘만 미리 받는다.
 * 개별 실패가 설치 전체를 막지 않게 한다 — 하나 못 받았다고 워커가 아예
 * 활성화되지 않으면 오프라인 지원이 통째로 사라진다.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.add(new Request(OFFLINE_URL, { cache: "reload" })).catch(() => {});

      const staticCache = await caches.open(STATIC_CACHE);
      await Promise.all(
        ["/icons/icon-192.png", "/icons/icon-512.png"].map((url) =>
          staticCache.add(new Request(url, { cache: "reload" })).catch(() => {}),
        ),
      );

      // 새 셸을 들고 대기하지 않는다 — 낡은 셸에 사용자를 붙잡아 두지 않기 위해
      // 즉시 교체한다. 캐싱 대상이 (a) 해시 파일명 정적 자산과 (b) 네트워크
      // 우선으로 갱신되는 공개 HTML뿐이라 즉시 교체가 안전하다.
      await self.skipWaiting();
    })(),
  );
});

/**
 * 캐시 엔트리 수 상한. VERSION이 안 바뀌는 한 activate의 "이전 버전 삭제"는
 * 영영 안 걸리는데, STATIC_CACHE는 배포마다 새 해시 청크를 계속 받아
 * 상한 없이 자란다. 오래된 것(삽입 순서 앞쪽)부터 지운다.
 */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

/** 활성화: 이전 버전 캐시를 지우고, 현재 캐시를 다듬고, 열려 있는 탭까지 바로 인수한다 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("light-") && !OWNED_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );
      await trimCache(STATIC_CACHE, 100);
      await trimCache(SHELL_CACHE, 30);
      await self.clients.claim();
    })(),
  );
});

/**
 * 공개 HTML: 네트워크 우선 → 실패 시 캐시 → 그것도 없으면 오프라인 폴백.
 * 민감 경로: 네트워크만 태우고, 실패하면 오프라인 폴백만 보여준다
 *            (회원 페이지 응답은 절대 캐시에 넣지 않는다).
 */
async function handleNavigation(request) {
  const pathname = new URL(request.url).pathname;
  const cacheable = isCacheableNavigation(pathname);

  try {
    const response = await fetch(request);
    if (cacheable && response.ok && response.type === "basic") {
      const shell = await caches.open(SHELL_CACHE);
      // 쿼리스트링을 떼고 pathname으로 저장한다. request 그대로 저장하면
      // `/news?utm_source=a`, `?utm_source=b`가 각각 HTML 전체를 새 엔트리로
      // 쌓는데, 읽는 쪽은 ignoreSearch라 어차피 구분해 꺼내지도 못한다.
      await shell.put(pathname, response.clone());
    }
    return response;
  } catch (error) {
    if (cacheable) {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
    }
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    throw error;
  }
}

/** 정적 자산: 캐시 우선 (해시 파일명이라 내용이 바뀌면 URL도 바뀐다) */
async function handleStatic(request) {
  // 전역 caches.match가 아니라 자기 캐시만 본다 — SHELL_CACHE의 HTML이
  // 정적 자산 응답으로 잘못 잡히는 경로를 원천 차단.
  const staticCache = await caches.open(STATIC_CACHE);
  const cached = await staticCache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await staticCache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // GET 이외, 다른 출처는 손대지 않는다
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isCacheableStatic(url.pathname)) {
    event.respondWith(handleStatic(request));
    return;
  }

  // 나머지는 전부 그냥 네트워크로 흘린다 — `/api/**`, `/_next/image`,
  // RSC 페이로드(`?_rsc=`), 회원 사진·주보가 모두 여기로 온다.
  // respondWith를 호출하지 않으면 브라우저 기본 동작이라 캐시에 남지 않는다.
});

/**
 * 로그아웃 시 방어적 정리. 설계상 회원 데이터는 애초에 캐시에 없지만,
 * 공용 기기를 생각하면 "없다고 믿는다"보다 "비운다"가 낫다.
 * (`src/components/pwa/ServiceWorkerRegistrar.tsx`에서 호출 가능)
 */
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_CACHES") return;
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("light-")).map((key) => caches.delete(key)),
      );
    })(),
  );
});
