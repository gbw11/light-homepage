import { cache } from "react";
import type { Metadata } from "next";
import { api, isApiError } from "@/lib/api";
import { decodeRouteParam } from "@/lib/routeParams";
import { Section } from "@/components/ui/Section";
import type { PostDetail } from "@/types/api";
import { MemberNoticeDetail } from "./_components/MemberNoticeDetail";
import { NoticeDetailView } from "./_components/NoticeDetailView";

/** ISR — 5분마다 재생성. 근거는 `/news`(목록 페이지)의 같은 상수 주석 참고 */
export const revalidate = 300;

type NoticeLookup =
  | { kind: "ok"; notice: PostDetail }
  | { kind: "not-found" }
  /** 회원 공지 — 서버(익명)는 401/403을 받는다. 클라이언트에서 다시 조회한다 */
  | { kind: "member-only" };

/**
 * `generateMetadata`와 페이지 본문이 같은 요청을 중복 호출하지 않도록
 * 요청 단위로 결과를 캐싱한다 (React `cache`).
 *
 * ⚠️ 서버의 fetch는 익명이다 — 회원 공지(`NOTICE_MEMBER`, SPEC_API §3.1 v1.3)는
 * 401이 정상 경로다. **회원 전용 본문을 정적 HTML에 굽지 않기 위한 설계**이므로
 * 에러로 다루지 않고 클라이언트 분기(`MemberNoticeDetail`)로 넘긴다.
 */
const getNotice = cache(async (slug: string): Promise<NoticeLookup> => {
  try {
    return { kind: "ok", notice: await api.posts.get(slug) };
  } catch (e) {
    if (isApiError(e) && e.code === "NOT_FOUND") return { kind: "not-found" };
    if (isApiError(e) && (e.code === "UNAUTHORIZED" || e.code === "FORBIDDEN")) {
      return { kind: "member-only" };
    }
    throw e;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getNotice(decodeRouteParam(slug));
  // 회원 공지는 제목도 싣지 않는다 — 로그인 전에 노출되는 정보를 만들지 않는다
  return { title: result.kind === "ok" ? result.notice.title : "소식" };
}

/** WIREFRAME.md §7 — 소식 상세 `/news/[slug]` (FR-PUB-07) */
export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  /*
    ⚠️ 인코딩을 여기서 되돌린다 — 이 호출부의 `slug`는 인코드된 채로 온다
    (`decodeRouteParam` 주석의 실측). 안 하면 한글 slug 글이 전부
    "찾을 수 없는 글"이 된다.
  */
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  const result = await getNotice(slug);

  if (result.kind === "not-found") {
    return (
      <main id="main" tabIndex={-1}>
        <Section>
          <p className="text-[var(--color-red-500)]">찾을 수 없는 글입니다.</p>
        </Section>
      </main>
    );
  }

  if (result.kind === "member-only") {
    return (
      <main id="main" tabIndex={-1}>
        <MemberNoticeDetail slug={slug} />
      </main>
    );
  }

  return (
    <main id="main" tabIndex={-1}>
      <NoticeDetailView notice={result.notice} />
    </main>
  );
}
