import { cache } from "react";
import type { Metadata } from "next";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { PostBodyView } from "@/components/post/PostBodyView";
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

/** 임시저장(`publish: false`) 글은 `publishedAt`이 null이다 (SPEC_API §3.4) */
function formatDate(iso: string | null): string {
  if (!iso) return "임시저장";
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
  return { title: notice?.title ?? "소식" };
}

/** WIREFRAME.md §7 — 소식 상세 `/news/[slug]` (FR-PUB-07) */
export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const notice = await getNotice(slug);

  if (!notice) {
    return (
      <main id="main" tabIndex={-1}>
        <Section>
          <p className="text-[var(--color-red-500)]">찾을 수 없는 글입니다.</p>
        </Section>
      </main>
    );
  }

  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <p className="text-sm font-bold text-[var(--color-gray-400)]">
          {notice.pinned && "📌 "}
          공지
        </p>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">{notice.title}</h1>
        <p className="mt-2 text-sm text-[var(--color-gray-400)]">
          {notice.authorName} · {formatDate(notice.publishedAt)}
        </p>

        {/* 에디터(PostEditor)와 같은 노드 집합을 렌더한다 — 어느 쪽도 앞서 나가지 않는다 */}
        <PostBodyView body={notice.body} className="mt-8" />

        {notice.attachments.length > 0 && (
          <div className="mt-8 border-t border-[var(--color-navy-100)] pt-6">
            <p className="text-sm font-bold text-[var(--color-gray-400)]">첨부파일</p>
            <ul className="mt-2 space-y-2">
              {notice.attachments.map((a) => (
                <li key={a.id}>
                  {/*
                    FR-DOC-05 — 302 → presigned(10분). fetch가 아니라 브라우저가
                    직접 이동해야 한다 (SPEC_API §4.2). 열람 권한은 글 권한을
                    상속하므로 로그아웃 상태에서는 서버가 거부한다.
                  */}
                  <a
                    href={api.attachments.downloadUrl(a.id)}
                    className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-sm text-[var(--color-gray-400)] hover:bg-[var(--color-navy-100)] hover:text-[var(--color-navy-900)]"
                  >
                    <span>📎 {a.filename}</span>
                    <span>{formatSize(a.sizeBytes)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </main>
  );
}
