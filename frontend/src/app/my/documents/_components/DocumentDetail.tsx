"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { PostBodyView } from "@/components/post/PostBodyView";
import { EditPostLink } from "@/components/post/EditPostLink";
import type { PostCategory } from "@/types/api";

const CATEGORY_LABEL: Partial<Record<PostCategory, string>> = {
  MINUTES: "회의록",
  BUDGET: "예산안",
};

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

/**
 * 문서 상세 본문 — `/news/[slug]`와 **같은 렌더러**(`PostBodyView`)를 쓴다.
 * 차이는 조회 위치뿐이다: 여기서는 임원 전용 내용이라 서버가 아니라 로그인한
 * 브라우저에서 조회한다 (page.tsx 주석).
 *
 * ⚠️ 회의록·예산안은 **에디터로 제목·목록·표 같은 구조를 써서 작성하는 글**이다.
 *    문단만 렌더하면 작성자가 쓴 구조가 조용히 사라진다 — 그래서 에디터
 *    (`components/post/PostEditor.tsx`)와 짝을 이루는 공용 렌더러를 쓴다.
 */
export function DocumentDetail({ slug }: { slug: string }) {
  const { data: post, isLoading, isError, error } = useQuery({
    queryKey: ["post", slug],
    queryFn: () => api.posts.get(slug),
    retry: false,
  });

  if (isLoading) {
    return (
      <Section>
        <p className="text-[var(--color-gray-400)]">불러오는 중...</p>
      </Section>
    );
  }

  if (isError || !post) {
    // 권한이 없어도 서버는 NOT_FOUND를 준다 (SPEC_API §3.3) — 존재 여부를
    // 알려주지 않는 게 의도이므로 화면도 구분하지 않고 같은 문구를 쓴다.
    const notFound = isApiError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN");
    return (
      <Section>
        <p role="alert" className="text-[var(--color-red-500)]">
          {notFound ? "찾을 수 없는 문서입니다." : "문서를 불러오지 못했습니다."}
        </p>
        <BackLink />
      </Section>
    );
  }

  return (
    <Section>
      <p className="text-sm font-bold text-[var(--color-gray-400)]">
        🔒 {post.pinned && "📌 "}
        {CATEGORY_LABEL[post.category] ?? "문서"}
      </p>
      <h2 className="mt-2 text-2xl font-bold md:text-3xl">{post.title}</h2>
      <p className="mt-2 text-sm text-[var(--color-gray-400)]">
        {post.authorName} · {formatDate(post.publishedAt)}
      </p>

      <div className="mt-4">
        <EditPostLink postId={post.id} />
      </div>

      <PostBodyView body={post.body} className="mt-8" />

      {post.attachments.length > 0 && (
        <div className="mt-8 border-t border-[var(--color-navy-100)] pt-6">
          <p className="text-sm font-bold text-[var(--color-gray-400)]">첨부파일</p>
          <ul className="mt-2 space-y-2">
            {post.attachments.map((a) => (
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

      <div className="mt-10">
        <BackLink />
      </div>
    </Section>
  );
}

function BackLink() {
  return (
    <Link
      href="/my/documents"
      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold transition hover:brightness-95"
    >
      목록으로
    </Link>
  );
}
