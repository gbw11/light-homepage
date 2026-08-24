"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import type { PostCategory } from "@/types/api";

const CATEGORY_LABEL: Partial<Record<PostCategory, string>> = {
  MINUTES: "회의록",
  BUDGET: "예산안",
};

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

/**
 * 문서 상세 본문 — `/news/[slug]`의 렌더링을 그대로 따른다 (문단만 렌더,
 * 첨부는 파일명 + 크기 목록). 차이는 조회 위치뿐이다: 여기서는 임원 전용
 * 내용이라 서버가 아니라 로그인한 브라우저에서 조회한다 (page.tsx 주석).
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
        <p className="text-[var(--color-red-500)]">
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
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">{post.title}</h1>
      <p className="mt-2 text-sm text-[var(--color-gray-400)]">
        {post.authorName} · {formatDate(post.publishedAt)}
      </p>

      <div className="mt-8 space-y-4 text-base leading-relaxed">
        {post.body.content.map((node, i) => {
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
          // 문단 외 노드 타입은 이번 단위에서 무시 (`/news/[slug]`와 동일)
          return null;
        })}
      </div>

      {post.attachments.length > 0 && (
        <div className="mt-8 border-t border-[var(--color-navy-100)] pt-6">
          <p className="text-sm font-bold text-[var(--color-gray-400)]">첨부파일</p>
          <ul className="mt-2 space-y-2">
            {post.attachments.map((a) => (
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
          <p className="mt-3 text-xs text-[var(--color-gray-400)]">
            첨부 다운로드는 게시물 열람 권한을 그대로 상속한다 (FR-DOC-05) —
            서명된 임시 URL이 준비되면 연결한다.
          </p>
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
