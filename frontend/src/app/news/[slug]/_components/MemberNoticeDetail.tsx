"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { MemberGate } from "@/components/auth/MemberGate";
import { NoticeDetailView } from "./NoticeDetailView";

/**
 * 회원 공지 상세 — **클라이언트에서만** 조회한다 (2026-08-31, SPEC_API §3.1 v1.3).
 *
 * `/news/[slug]`는 ISR 서버 렌더인데, 서버의 익명 fetch로는 회원 공지를
 * 가져올 수 없고(401) 가져와서도 안 된다 — 회원 전용 본문이 정적 HTML에
 * 구워져 비로그인 브라우저까지 내려가면 게이트가 무의미해진다. 그래서 서버가
 * 401/403을 받으면 이 컴포넌트로 분기해, 로그인한 브라우저의 쿠키로 다시
 * 조회한다 (`page.tsx` 참고).
 */
export function MemberNoticeDetail({ slug }: { slug: string }) {
  return (
    <MemberGate description="회원 공지는 로그인하면 볼 수 있습니다.">
      <MemberNoticeContent slug={slug} />
    </MemberGate>
  );
}

function MemberNoticeContent({ slug }: { slug: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["posts", "detail", slug],
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

  if (isError || !data) {
    return (
      <Section>
        <p role="alert" className="text-[var(--color-red-500)]">
          {isApiError(error) && error.code !== "NOT_FOUND"
            ? error.message
            : "찾을 수 없는 글입니다."}
        </p>
      </Section>
    );
  }

  return <NoticeDetailView notice={data} />;
}
