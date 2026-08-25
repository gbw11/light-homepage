"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/providers/AuthProvider";
import type { MeetingSummary } from "@/types/api";
import {
  MEETING_STATUS_DOT,
  MEETING_STATUS_LABEL,
  formatDeadline,
  formatMeetingDate,
  formatRemaining,
  secondsUntil,
} from "./meetingFormat";

/** SPEC_API §7.1 기본 페이지 크기 */
const PAGE_SIZE = 20;

/** 남은 시간 문구를 갱신하는 주기. 목록에서는 초 단위까지 필요 없다 */
const TICK_MS = 30_000;

/**
 * WIREFRAME.md §14b-1 · FR-MTG-01/05 — 월례회 자료 목록.
 *
 * 세 상태를 각각 다르게 보여준다 (SPEC_API §7.1):
 * · `OPEN`     마감시각 + 남은 시간을 **크게** 보여주고 `[열람하기]`를 준다.
 *              열람 기간이 2일 남짓이라 놓치면 다음 월례회까지 못 본다.
 * · `SCHEDULED` 아직 열리지 않았다는 사실과 시작 시각만 알린다.
 * · `CLOSED`   **목록에는 남기고 열 수는 없다** ("존재는 알리되 내용은 차단").
 *              카드를 지우면 회원이 "자료가 있었는지"조차 알 수 없게 된다.
 *
 * ⚠️ 임원(`L` 이상)에게는 세 상태 모두 `[열람하기]`가 보인다 —
 * SPEC_API §7.1 "`L` 이상은 `status`와 무관하게 열람 가능". 다만 이건
 * **UI 편의일 뿐**이고, 실제 판정은 페이지 이미지를 스트리밍하는 서버가
 * 매 요청마다 다시 한다 (§7.3 처리 순서 2).
 */
/**
 * 남은 시간 문구. 잎 컴포넌트로 분리한 이유: 틱 상태가 목록에 있으면 30초마다
 * **카드 전체(20장)**가 다시 그려진다 — 주기적으로 바뀌는 건 OPEN 카드의
 * 이 문구뿐이고, OPEN은 보통 한 장이다.
 */
function RemainingText({ until }: { until: string }) {
  // 문구가 화면에 그대로 굳어 있지 않게 주기적으로 다시 그린다
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return <>({formatRemaining(secondsUntil(until))})</>;
}

export function MeetingList() {
  const { user } = useAuth();
  const isLeader = user?.role === "LEADER" || user?.role === "PASTOR";

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["meetings", "list"],
      queryFn: ({ pageParam }) => api.meetings.list({ page: pageParam, size: PAGE_SIZE }),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    });

  if (isLoading) {
    return <p className="text-[var(--color-gray-400)]">불러오는 중...</p>;
  }

  if (isError) {
    return (
      <p className="text-[var(--color-red-500)]">
        {isApiError(error) ? error.message : "월례회 자료를 불러오지 못했습니다."}
      </p>
    );
  }

  const items: MeetingSummary[] = data?.pages.flatMap((p) => p.items) ?? [];

  if (items.length === 0) {
    return <p className="text-[var(--color-gray-400)]">등록된 월례회 자료가 없습니다.</p>;
  }

  return (
    <div>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id}>
            <MeetingCard item={item} isLeader={isLeader} />
          </li>
        ))}
      </ul>

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

      {/*
        ARCHITECTURE.md §7.7 "정직하게 알려야 할 것" — 목록에서도 한 번 밝힌다.
        "막았다"고 믿게 만드는 것이 이 기능에서 가장 위험한 결과다.
      */}
      <p className="mt-8 text-xs leading-relaxed text-[var(--color-gray-400)]">
        월례회 자료는 열람 기간 안에서만 볼 수 있고, 페이지마다 열람자 이름이
        표시됩니다. 캡처 자체를 막을 수는 없으니 자료를 외부로 옮기지 말아 주세요.
      </p>
    </div>
  );
}

function MeetingCard({ item, isLeader }: { item: MeetingSummary; isLeader: boolean }) {
  const openable = item.status === "OPEN" || isLeader;

  return (
    <article className="rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-5">
      <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
        <span>
          <span aria-hidden>{MEETING_STATUS_DOT[item.status]}</span>{" "}
          {MEETING_STATUS_LABEL[item.status]}
        </span>
        {/* WIREFRAME §14b-3 — 임원이 기간 밖 자료를 여는 경우임을 화면에 밝힌다 */}
        {isLeader && item.status !== "OPEN" && (
          <span className="rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-2 py-0.5 text-xs">
            임원 열람
          </span>
        )}
      </p>

      <h2 className="mt-2 text-lg font-bold">{item.title}</h2>

      <p className="mt-1 text-sm text-[var(--color-gray-400)]">
        {formatMeetingDate(item.meetingDate)} · {item.pageCount}페이지
      </p>

      {item.status === "OPEN" && (
        <p className="mt-3 font-bold">
          <span aria-hidden>⏳</span> {formatDeadline(item.viewableUntil)}까지{" "}
          <span className="font-normal text-[var(--color-gray-400)]">
            <RemainingText until={item.viewableUntil} />
          </span>
        </p>
      )}

      {item.status === "SCHEDULED" && (
        <p className="mt-3 text-sm text-[var(--color-gray-400)]">
          {formatDeadline(item.viewableFrom)}부터 열람할 수 있습니다.
        </p>
      )}

      {item.status === "CLOSED" && (
        <p className="mt-3 text-sm text-[var(--color-gray-400)]">
          열람 기간이 끝났습니다 ({formatDeadline(item.viewableFrom)} ~{" "}
          {formatDeadline(item.viewableUntil)}).
          {/* 임원 자신에게 "임원에게 문의하세요"라고 하지 않는다 */}
          {!isLeader && " 자료가 필요하시면 임원에게 문의해 주세요."}
        </p>
      )}

      {openable && (
        <div className="mt-4">
          <Link
            href={`/meetings/${item.id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
          >
            열람하기
          </Link>
        </div>
      )}
    </article>
  );
}
