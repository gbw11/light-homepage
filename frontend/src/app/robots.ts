import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * 색인 차단 대상 (NFR-SEC-29). `next.config.ts`의 `X-Robots-Tag` 헤더와
 * 이중으로 방어하고, 두 목록은 항상 같이 고쳐야 한다.
 *
 * ⚠️ 공개 열람 전환(PM 결정 2026-08-25) 이후에도 **자료 화면의 색인은 계속
 *    막는다.** "로그인 없이 볼 수 있다"와 "구글 이미지 검색에 얼굴 사진이
 *    뜬다"는 전혀 다른 문제라, PM이 noindex 유지를 택했다. 그래서 자료 경로
 *    (`/photos`·`/bulletin`·`/meetings`·`/documents`)가 공개
 *    라우트가 된 지금도 목록에 그대로 남아 있다.
 *
 * ⚠️ mock 개발용 사진 자산은 **2026-08-27에 `public/` 밖으로 옮겼다**
 *    (`frontend/mock-assets/`). `/mock-assets/*` route handler가 배포에서
 *    404를 주므로, 이제 색인 차단이 아니라 **코드가 막는다**
 *    (PM 결정 2026-08-27, 1안 — `docs/DECISIONS.md`).
 *
 *    🔴 그 전에 쓰던 `.vercelignore`(2안)는 **동작하지 않았다** — Git 연동
 *    배포에서 `/photos/retreat-2026/thumb/p001.webp`가 200으로 서빙되는 것을
 *    실측했다. robots·헤더는 크롤러에게 부탁하는 것일 뿐 직접 접근을 막지
 *    못하므로, 그것들만 믿으면 안 된다.
 *
 *    `/bulletins`는 `public/`에 남아 있다 — "PLACEHOLDER" 생성물이고 개인정보가
 *    아니다. 색인만 막는다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/my",
        "/admin",
        "/photos",
        "/bulletin",
        "/bulletins",
        "/mock-assets",
        "/meetings",
        "/documents",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
