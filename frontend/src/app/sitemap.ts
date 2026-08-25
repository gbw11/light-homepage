import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * 공개 영역 라우트만 포함한다. 회원(`/my`)·운영(`/admin`) 영역은
 * `robots.ts`/`next.config.ts`에서 이미 색인을 막으므로 여기 넣지 않는다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/welcome",
    "/welcome/register",
    "/about",
    "/worship",
    "/sermons",
    "/news",
    "/location",
    "/contact",
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
  }));
}
