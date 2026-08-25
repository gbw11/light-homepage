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

  // 회원·운영 영역은 검색엔진에 노출되지 않아야 한다 (NFR-SEC-29)
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
        source: "/(my|admin)/:path*",
        headers: noindex,
      },
      {
        /**
         * mock 개발용 사진·주보 자산. `public/`은 인증 없이 서빙되므로
         * 최소한 색인은 막는다.
         *
         * ⚠️ 헤더로는 **직접 접근을 막을 수 없다.** 실제 방어는 이 자산을
         *    운영 배포에 포함하지 않는 것이다 — `docs/DECISIONS.md` 참고.
         */
        source: "/(photos|bulletins)/:path*",
        headers: noindex,
      },
    ];
  },
};

export default nextConfig;
