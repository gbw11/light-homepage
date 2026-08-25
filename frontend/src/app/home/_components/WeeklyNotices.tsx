"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { postHref } from "@/lib/post/href";

/** HOME에 몇 개만 보여준다 — 전체는 `/news` */
const PREVIEW_COUNT = 3;

/** `2026-08-24T...` → `8/24` */
function formatShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * HOME "이번 주" 공지 미리보기 (FR-PUB-01).
 *
 * 예전에는 이 파일 대신 `home/page.tsx`가 하드코딩 배열을 들고 있었다 —
 * 공지를 올려도 HOME은 영원히 옛 목록을 보여줬다.
 *
 * ⚠️ **서버에서 가져오지 않는다.** HOME은 정적 페이지이고, 서버 컴포넌트에서
 * API를 부르면 백엔드가 없는 환경에서 정적 생성이 응답을 기다리다 빌드가
 * 죽는다 — `/news`가 정확히 그래서 CI를 깨뜨렸다(`app/news/page.tsx` 주석).
 * 그래서 HOME의 정적 골격은 그대로 두고 이 블록만 브라우저에서 채운다.
 *
 * 로딩·실패·빈 목록에서 **자리를 비워두지 않고 링크만 남긴다.** 첫 화면에서
 * 에러 문구를 보여주는 것보다, 공지가 없는 것처럼 보이고 전체보기로 갈 수
 * 있는 편이 낫다.
 */
export function WeeklyNotices() {
  const { data, isError } = useQuery({
    queryKey: ["posts", "NOTICE_PUBLIC"],
    queryFn: () => api.posts.list({ category: "NOTICE_PUBLIC" }),
  });

  const notices = (data?.items ?? []).slice(0, PREVIEW_COUNT);

  return (
    <>
      {notices.length > 0 && (
        <ul className="divide-y divide-[var(--color-navy-100)]">
          {notices.map((notice) => (
            <li key={notice.id}>
              <Link
                href={postHref(notice.category, notice.slug)}
                className="flex min-h-11 items-center gap-4 py-3"
              >
                <span className="w-12 shrink-0 text-sm text-[var(--color-gray-400)]">
                  {formatShort(notice.publishedAt)}
                </span>
                <span className="font-bold">{notice.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* 조회 실패를 첫 화면에서 떠들지 않는다 — 스크린리더에만 알린다 */}
      {isError && (
        <p className="sr-only" role="status">
          공지를 불러오지 못했습니다. 공지 전체보기에서 확인할 수 있습니다.
        </p>
      )}
    </>
  );
}
