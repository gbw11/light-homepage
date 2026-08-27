import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";


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
 * ⚠️ `/photos`·`/bulletins`는 `public/`에 있는 **mock 개발용 자산** 경로이기도
 *    하다 (라우트와 우연히 겹친다).
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
      disallow: [
        "/my",
        "/admin",
        "/photos",
        "/bulletin",
        "/bulletins",
        "/meetings",
        "/documents",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
