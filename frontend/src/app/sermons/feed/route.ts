import type { Sermon } from "@/types/api";

/**
 * YouTube 채널 피드 프록시 — `GET /sermons/feed`
 *
 * ## 왜 이게 있나
 *
 * 말씀 화면이 보여줄 영상 목록의 **원본은 백엔드**다 (`SPEC_API §9.2` — BE가
 * YouTube Data API를 프록시한다). 그런데 그 엔드포인트는 아직 없고, 지금
 * 배포된 빌드는 `NEXT_PUBLIC_USE_MOCK=1`이라 **하드코딩된 목록**을 본다.
 * 하드코딩은 새 설교가 올라와도 갱신되지 않는다.
 *
 * 그래서 **BE가 붙기 전까지 쓰는 다리**를 놓는다. YouTube가 공개하는
 * 채널 RSS를 서버에서 읽어 같은 모양(`Sermon[]`)으로 돌려준다.
 *
 * ## 왜 RSS인가 (YouTube Data API가 아니라)
 *
 * · **API 키가 필요 없다.** 키를 만들면 발급·보관·로테이션이 따라오고,
 *   Vercel 환경변수에 넣어야 하며, 유출되면 남이 우리 쿼터를 쓴다
 * · **쿼터가 없다.** Data API는 하루 10,000 units에 `search.list`가 100 units다
 * · 최신 **15편**만 준다는 한계가 있는데, 이 화면이 필요한 양이 딱 그 정도다.
 *   그 이상은 "유튜브로 바로가기"가 담당한다 (PM 결정 2026-09-01)
 *
 * ## 왜 `/api/` 밖인가
 *
 * `next.config.ts`가 `/api/:path*`를 Spring 백엔드로 rewrite한다. 이 라우트를
 * `/api/` 아래 두면 실백엔드 환경에서 프록시와 겹칠 수 있다. **경로로 미리
 * 떼어놓는 편이** 나중에 원인을 찾는 것보다 싸다.
 *
 * ## 지울 때
 *
 * BE의 `GET /api/sermons`가 붙고 `NEXT_PUBLIC_USE_MOCK=0`이 되면 이 라우트는
 * 쓰이지 않는다. 그때 파일째 지우면 된다 — 화면은 계약(`api.sermons.list`)만
 * 알고 있어서 영향받지 않는다.
 */

/** 김해교회 청년교회 LIGHT (`@light4402`) */
const CHANNEL_ID = "UCiG_caE3_ZPu2y04ei_mC7Q";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

/**
 * 30분마다 다시 읽는다.
 *
 * 설교는 주 1회 올라온다 — 분 단위 신선도가 필요 없다. 반대로 하루로 두면
 * 주일 예배가 끝난 뒤에도 한참 목록에 안 보인다. 라이브 감지는 이 라우트가
 * 하지 않는다(`sermons.live` 계약이 담당).
 */
export const revalidate = 1800;

/** XML 엔티티를 되돌린다 — 제목에 `&`·따옴표가 들어간다 */
function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * 설교 영상만 고른다.
 *
 * 채널에는 브이로그·찬양 커버·티저가 섞여 있다. "지난 말씀"에 그것들이
 * 들어가면 화면 이름과 내용이 어긋난다. 주일 예배 영상은 제목이 **날짜로
 * 시작**한다 (`2026년 8월 30일 l 하나님께 소망을 두고 있나요? l [...]`).
 */
const SERMON_TITLE = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/;

/**
 * 화면에 쓸 제목만 남긴다.
 *
 * 날짜는 카드가 따로 보여주고, `[김해교회 LIGHT청년교회]` 꼬리표는 모든
 * 영상에 똑같이 붙어 있어 정보가 없다. 둘 다 떼면 실제 설교 제목이 남는다.
 */
function cleanTitle(raw: string): string {
  return raw
    .replace(SERMON_TITLE, "")
    .replace(/\[.*?\]\s*$/, "")
    .replace(/^[\sㅣl|·–—-]+/, "")
    .replace(/[\sㅣl|·–—-]+$/, "")
    .trim();
}

function parseFeed(xml: string): Sermon[] {
  const entries = xml.split("<entry>").slice(1);
  const sermons: Sermon[] = [];

  for (const entry of entries) {
    const id = entry.match(/<yt:videoId>([\w-]+)<\/yt:videoId>/)?.[1];
    const rawTitle = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!id || !rawTitle || !published) continue;

    const title = unescapeXml(rawTitle).trim();
    if (!SERMON_TITLE.test(title)) continue;

    sermons.push({
      id,
      title: cleanTitle(title) || title,
      publishedAt: new Date(published).toISOString(),
      youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
  }

  // RSS는 최신순으로 오지만 보장된 계약이 아니다 — 화면이 정렬하지 않도록 여기서 맞춘다
  return sermons.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

/**
 * 마지막으로 성공한 목록.
 *
 * 배포 후 실측에서 **YouTube가 서버 요청에 간헐적으로 404를 준다.** 로컬
 * curl은 항상 200이라 IP 기반(데이터센터 대역) 제한으로 보인다. 한 번
 * 실패했다고 빈 목록을 주면 화면이 하드코딩 스냅샷으로 내려앉는데, 그
 * 스냅샷은 갱신되지 않는 옛 목록이다.
 *
 * 그래서 **직전 성공분을 들고 있다가 실패하면 그걸 준다.** 서버리스 인스턴스가
 * 재사용되는 동안만 유지되지만, 산발적 404를 덮기에는 그것으로 충분하다.
 * (완전한 해결은 BE의 `GET /api/sermons`다 — 이 라우트는 그때 지운다.)
 */
let lastGood: Sermon[] | null = null;

/**
 * 한 번 실패하면 한 번 더 시도한다.
 *
 * ⚠️ `next: { revalidate }`를 쓰지 않는다. Next의 Data Cache는 **실패 응답도
 * 캐시한다** — 404 한 번이 30분 동안 굳어버린다. 캐시는 이 라우트의
 * `export const revalidate`(응답 단위)가 담당하고, 업스트림 호출은
 * `no-store`로 매번 새로 한다.
 *
 * User-Agent를 붙이는 이유: 기본값이 비어 있으면 거절하는 엔드포인트가 있다.
 * 로컬 실측에서는 UA와 무관하게 200이었지만, 붙여서 손해 볼 것이 없다.
 */
async function fetchFeed(): Promise<Sermon[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(FEED_URL, {
        cache: "no-store",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LightChurchSite/1.0; +https://light-homepage-light-ba18.vercel.app)",
          Accept: "application/atom+xml, application/xml;q=0.9, */*;q=0.8",
        },
      });
      if (!res.ok) continue;
      const items = parseFeed(await res.text());
      if (items.length > 0) return items;
    } catch {
      // 다음 시도로 넘어간다
    }
  }
  return null;
}

export async function GET() {
  const fresh = await fetchFeed();
  if (fresh) {
    lastGood = fresh;
    return Response.json({ items: fresh, stale: false });
  }

  // 업스트림이 막혔지만 직전 성공분이 있으면 그걸 준다 — 화면이 스냅샷으로
  // 내려앉는 것보다 낫다. `stale`로 사실을 숨기지는 않는다
  if (lastGood) return Response.json({ items: lastGood, stale: true });

  // 줄 것이 정말 없을 때만 실패를 알린다 — 호출부가 스냅샷으로 넘어간다
  return Response.json({ items: [], error: "feed unavailable" }, { status: 502 });
}
