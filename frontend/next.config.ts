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
    return [
      {
        source: "/(my|admin)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
