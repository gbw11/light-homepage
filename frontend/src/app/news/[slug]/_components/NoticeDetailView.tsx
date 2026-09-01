import { api } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { PostBodyView } from "@/components/post/PostBodyView";
import { EditPostLink } from "@/components/post/EditPostLink";
import type { PostDetail } from "@/types/api";

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
 * 공지 상세 렌더 — 서버(공개 공지, ISR)와 클라이언트(회원 공지) **양쪽에서
 * 같은 노드를 그린다.** 회원 공지가 클라이언트 fetch로 분기하면서(2026-08-31,
 * `page.tsx` 주석) 렌더가 두 곳이 됐는데, 여기 하나로 모아 어긋나지 않게 한다.
 */
export function NoticeDetailView({ notice }: { notice: PostDetail }) {
  return (
    <Section>
      <p className="text-sm font-bold text-[var(--color-gray-400)]">
        {/* 회원 전용 표시 (SPEC_API §3.1 v1.3) */}
        {notice.category === "NOTICE_MEMBER" && "🔒 회원 · "}
        {notice.pinned && "📌 "}
        공지
      </p>
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">{notice.title}</h1>
      <p className="mt-2 text-sm text-[var(--color-gray-400)]">
        {notice.authorName} · {formatDate(notice.publishedAt)}
      </p>

      {/* EditPostLink는 임원이 아니면 아무것도 그리지 않는다 */}
      <div className="mt-4">
        <EditPostLink postId={notice.id} />
      </div>

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
                  className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-sm text-[var(--color-gray-400)] hover:bg-[var(--color-navy-100)] hover:text-[var(--color-ink)]"
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
  );
}
