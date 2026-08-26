"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import type { BulletinSummary } from "@/types/api";

/** SPEC_API §5.2 기본 페이지 크기 */
const PAGE_SIZE = 20;

type PastBulletinListProps = {
  /** 지금 뷰어에 열려 있는 주보 id — 목록에서 현재 위치를 표시한다 */
  selectedId: string;
  onSelect: (id: string) => void;
};

/**
 * WIREFRAME.md §12 "지난 주보" · FR-BUL-02 — 주일 날짜 최신순 + 페이지네이션.
 *
 * 행을 누르면 라우팅 없이 위 뷰어를 교체한다(`BulletinScreen`). 그래서
 * `Link`가 아니라 `button`이다 — 이동하지 않는 조작을 링크로 만들지 않는다.
 *
 * ⚠️ 여기서만 `thumbUrl`을 쓴다. 뷰어는 반대로 큰 이미지를 바로 로드한다
 * (FR-BUL-03) — 목록 행에서 2048px를 200개 받으면 안 된다.
 */
export function PastBulletinList({ selectedId, onSelect }: PastBulletinListProps) {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["bulletins", "list"],
      queryFn: ({ pageParam }) => api.bulletins.list({ page: pageParam, size: PAGE_SIZE }),
      initialPageParam: 0,
      // hasNext가 false면 undefined를 돌려줘야 TanStack Query가 끝으로 판단한다
      getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    });

  const items: BulletinSummary[] = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section aria-labelledby="past-bulletins-heading">
      <h2 id="past-bulletins-heading" className="mb-4 text-lg font-bold md:text-xl">
        지난 주보
      </h2>

      {isLoading && <p className="text-[var(--color-gray-400)]">불러오는 중...</p>}

      {isError && (
        <p className="text-[var(--color-red-500)]">
          {isApiError(error) ? error.message : "지난 주보를 불러오지 못했습니다."}
        </p>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <p className="text-[var(--color-gray-400)]">지난 주보가 없습니다.</p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-[var(--color-navy-100)]">
          {items.map((item) => (
            <li key={item.id}>
              <BulletinRow
                item={item}
                selected={item.id === selectedId}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      )}

      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "불러오는 중..." : "더 보기"}
          </Button>
        </div>
      )}
    </section>
  );
}

function BulletinRow({
  item,
  selected,
  onSelect,
}: {
  item: BulletinSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-center gap-4 py-3 text-left transition hover:bg-[var(--color-navy-100)]/40 ${
        selected ? "font-bold" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 실서비스 URL은 R2 presigned(만료·서명 포함)라 next/image 최적화 대상이 아니다 (SPEC_API §5.2) */}
      <img
        src={item.thumbUrl}
        alt=""
        className="h-16 w-12 shrink-0 rounded border border-[var(--color-navy-100)] bg-[var(--color-navy-100)]/40 object-cover"
        loading="lazy"
      />
      <span className="min-w-0 flex-1">
        <span className="block">{item.serviceDate}</span>
        <span className="block text-sm text-[var(--color-gray-400)]">
          {item.pageCount}장{selected && " · 보고 있음"}
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-[var(--color-gray-400)]">
        ▸
      </span>
    </button>
  );
}
