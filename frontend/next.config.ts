import type { NextConfig } from "next";

/**
 * /api/** 를 Spring 백엔드로 프록시한다.
 *
 * 브라우저는 항상 자기 출처(localhost:3000)로 요청하므로
 *   · CORS 설정이 불필요하고
 *   · httpOnly 쿠키가 서드파티 쿠키가 되지 않는다.
 * 설계: docs/ARCHITECTURE.md · docs/SPEC_API.md §1
 *
 * ⚠️ API_ORIGIN은 서버 전용이다. NEXT_PUBLIC_ 접두사를 붙이지 않는다.
 */
const nextConfig: NextConfig = {
  images: {
    /**
     * next/image가 최적화한 결과의 캐시 수명. 기본 4시간인데, 대상이
     * public/images의 손으로 관리하는 불변 자산 3장뿐이라(회원 사진은
     * presigned URL이라 <img> 직접 사용 — COMPONENTS.md §6.1) 하루 6번
     * 재최적화할 이유가 없다. 파일을 교체할 일이 생기면 파일명을 바꾼다.
     */
    minimumCacheTTL: 31536000,
  },

  async rewrites() {
    const origin = process.env.API_ORIGIN;
    if (!origin) return [];

    return [
      {
        source: "/api/:path*",
        destination: `${origin}/api/:path*`,
      },
    ];
  },

  /**
   * 옛 회원 전용 주소 → 공개 주소 (PM 결정 2026-08-25: 열람 공개).
   * 이미 공유된 링크·북마크·PWA 바로가기가 깨지지 않게 영구 리다이렉트한다.
   */
  async redirects() {
    const moved = ["photos", "bulletin", "meetings", "documents"].flatMap((seg) => [
      { source: `/my/${seg}`, destination: `/${seg}`, permanent: true },
      { source: `/my/${seg}/:path*`, destination: `/${seg}/:path*`, permanent: true },
    ]);

    /**
     * 공지 통합 (PM 결정 2026-08-25): `/notices`는 `/news`와 같은 목록이 되어
     * 없앴다. 옛 주소 두 벌(`/my/notices`도 한때 유효했다)을 모두 보낸다.
     */
    const notices = [
      { source: "/notices", destination: "/news", permanent: true },
      { source: "/notices/:slug", destination: "/news/:slug", permanent: true },
      { source: "/my/notices", destination: "/news", permanent: true },
      { source: "/my/notices/:slug", destination: "/news/:slug", permanent: true },
    ];

    return [...moved, ...notices];
  },

  // 색인 차단 대상 (NFR-SEC-29) — `src/app/robots.ts`의 목록과 같이 유지한다
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      {
        /**
         * public/ 은 기본이 max-age=0이라 PWA 아이콘·매니페스트 아이콘이
         * 내비게이션마다 재검증 왕복을 만든다. 아이콘은 내용이 바뀌면
         * 파일명을 바꾸는 불변 자산이므로 1년 immutable로 고정한다.
         */
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        /**
         * 자료 화면은 공개지만 색인은 막는다 (PM 결정 2026-08-25 —
         * `robots.ts` 주석의 "공개 ≠ 검색 노출" 참고).
         */
        source: "/(my|admin|photos|bulletin|meetings|documents)/:path*",
        headers: noindex,
      },
      {
        /**
         * mock 개발용 자산. 색인만 막는다.
         *
         * ⚠️ 헤더로는 **직접 접근을 막을 수 없다.** 실제 방어는 사진 자산을
         *    `public/` 밖(`frontend/mock-assets/`)에 두고 `/mock-assets/*`
         *    route handler가 **배포에서 404를 주는 것**이다
         *    (PM 결정 2026-08-27, 1안 — `docs/DECISIONS.md`).
         *
         * `bulletins`는 `public/`에 남아 있다 — "PLACEHOLDER" 문구가 찍힌
         * 생성물이고 개인정보가 아니다 (`mock.ts` 주보 mock 주석에서 확인).
         */
        source: "/(mock-assets|bulletins)/:path*",
        headers: noindex,
      },
    ];
  },
};

export default nextConfig;
