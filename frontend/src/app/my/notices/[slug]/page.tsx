import { cache } from "react";
import type { Metadata } from "next";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { RequireMember } from "@/components/auth/RequireMember";
import type { PostDetail } from "@/types/api";

/**
 * `generateMetadata`와 페이지 본문이 같은 요청을 중복 호출하지 않도록
 * 요청 단위로 결과를 캐싱한다 (React `cache`).
 */
const getNotice = cache(async (slug: string): Promise<PostDetail | null> => {
  try {
    return await api.posts.get(slug);
  } catch (e) {
    if (isApiError(e) && e.code === "NOT_FOUND") return null;
    throw e;
  }
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const notice = await getNotice(slug);
  return { title: notice?.title ?? "내부 공지" };
}

/**
 * WIREFRAME.md §14 — 내부 공지 상세 `/my/notices/[slug]`.
 * `api.posts.get`은 category를 구분하지 않으므로 `NOTICE_PUBLIC`,
 * `NOTICE_MEMBER` 글 모두 동일하게 렌더한다 (SPEC_API §3.3). 이 라우트
 * 자체는 회원(`M`) 이상만 접근 가능해야 하므로 `RequireMember`로 감싼다.
 *
 * ⚠️ 열람 권한 자체(비회원이 내부 공지 slug로 직접 접근하는 경우 등)는
 * 서버가 최종 판단한다 — `RequireMember`는 헛걸음을 줄이는 UI 편의일 뿐
 * 실제 인가가 아니다 (`RequireMember.tsx` 주석 참고).
 */
export default async function MyNoticeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const notice = await getNotice(slug);

  if (!notice) {
    return (
      <RequireMember>
        <main id="main" tabIndex={-1}>
          <Section>
            <p className="text-[var(--color-red-500)]">찾을 수 없는 글입니다.</p>
          </Section>
        </main>
      </RequireMember>
    );
  }

  return (
    <RequireMember>
      <main id="main" tabIndex={-1}>
        <Section>
          <p className="text-sm font-bold text-[var(--color-gray-400)]">
            {notice.category === "NOTICE_MEMBER" && "🔒 "}
            {notice.pinned && "📌 "}
            공지
          </p>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">{notice.title}</h1>
          <p className="mt-2 text-sm text-[var(--color-gray-400)]">
            {notice.authorName} · {formatDate(notice.publishedAt)}
          </p>

          <div className="mt-8 space-y-4 text-base leading-relaxed">
            {notice.body.content.map((node, i) => {
              if (
                typeof node === "object" &&
                node !== null &&
                "type" in node &&
                (node as { type: unknown }).type === "paragraph" &&
                "content" in node
              ) {
                const inline = (node as { content: unknown[] }).content;
                const text = inline
                  .map((t) =>
                    typeof t === "object" && t !== null && "text" in t
                      ? String((t as { text: unknown }).text)
                      : "",
                  )
                  .join("");
                return <p key={i}>{text}</p>;
              }
              // 문단 외 노드 타입은 이번 단위에서 무시
              return null;
            })}
          </div>

          {notice.attachments.length > 0 && (
            <div className="mt-8 border-t border-[var(--color-navy-100)] pt-6">
              <p className="text-sm font-bold text-[var(--color-gray-400)]">첨부파일</p>
              <ul className="mt-2 space-y-2">
                {notice.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-4 text-sm text-[var(--color-gray-400)]"
                    title="다운로드는 준비 중입니다"
                  >
                    <span>📎 {a.filename}</span>
                    <span>{formatSize(a.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      </main>
    </RequireMember>
  );
}
