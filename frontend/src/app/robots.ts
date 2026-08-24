import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * 회원(`/my`)·운영(`/admin`) 영역은 검색엔진 색인을 차단한다 (NFR-SEC-29).
 * `next.config.ts`의 `X-Robots-Tag` 헤더와 이중으로 방어한다.
 *
 * ⚠️ `/photos`·`/bulletins`는 `public/`에 있는 **mock 개발용 자산**이다.
 *    회원 사진(실제 인물)이 들어 있는데 `public/`은 인증 없이 서빙되므로
 *    색인만이라도 막는다.
 *
 *    **이것만으로는 부족하다** — robots는 크롤러에게 부탁하는 것일 뿐,
 *    URL을 아는 사람의 직접 접근은 막지 못한다. 실서비스는 사진을 R2
 *    presigned URL(만료됨)로 서빙하므로 이 자산이 배포에 포함되면 안 된다.
 *    `docs/DECISIONS.md` 2026-08-24 "mock 사진 자산 배포 제외" 항목 참고.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/my", "/admin", "/photos", "/bulletins"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
