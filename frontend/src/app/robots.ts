import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * 회원(`/my`)·운영(`/admin`) 영역은 검색엔진 색인을 차단한다 (NFR-SEC-29).
 * `next.config.ts`의 `X-Robots-Tag` 헤더와 이중으로 방어한다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/my", "/admin"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
