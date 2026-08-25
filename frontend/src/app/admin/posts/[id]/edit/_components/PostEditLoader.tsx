"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { PostForm } from "@/components/post/PostForm";

/**
 * 수정할 글을 불러와 `PostForm`에 넘긴다 (SPEC_API §3.3 → §3.5).
 *
 * 서버 컴포넌트에서 가져오지 않는 이유는 `/my/documents/[slug]`와 같다 —
 * 회원 전용 데이터를 서버에서 prefetch하면 세션이 없어 실패하고, 성공하면
 * 그 내용이 정적 HTML에 구워진다 (docs/DECISIONS.md 2026-08-24).
 * 수정 화면은 회의록·예산안 본문까지 다루므로 더더욱 그렇다.
 *
 * `staleTime: 0`인 이유: 저장하고 돌아왔을 때 캐시된 옛 본문이 폼의 초기값이
 * 되면 방금 한 수정을 되돌려 저장하게 된다.
 */
export function PostEditLoader({ id }: { id: string }) {
  const {
    data: post,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["post", id],
    queryFn: () => api.posts.get(id),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  if (isLoading) {
    return (
      <Section>
        <p className="text-[var(--color-gray-400)]">불러오는 중...</p>
      </Section>
    );
  }

  if (isError || !post) {
    // 권한이 없어도 서버는 상세에 NOT_FOUND를 준다 (SPEC_API §3.3) —
    // 존재 여부를 알려주지 않는 게 의도라 화면도 구분하지 않는다.
    const missing =
      isApiError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN");
    return (
      <Section>
        <p role="alert" className="text-[var(--color-red-500)]">
          {missing ? "찾을 수 없는 글입니다." : "글을 불러오지 못했습니다."}
        </p>
        <Link
          href="/my"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-bold hover:underline"
        >
          ← 나의 LIGHT
        </Link>
      </Section>
    );
  }

  return (
    <Section>
      <Link
        href="/my"
        className="text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-navy-900)]"
      >
        ← 나의 LIGHT
      </Link>
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">글 수정</h1>
      {/*
        어느 글을 고치는 중인지 보여준다. 제목은 폼 안에서 바뀔 수 있으므로
        불러온 시점의 원래 제목을 적는다 — "내가 맞는 글을 열었나"의 근거다.
      */}
      <p className="mt-2 text-sm text-[var(--color-gray-400)]">원래 제목: {post.title}</p>

      <div className="mt-8">
        <PostForm post={post} />
      </div>
    </Section>
  );
}
