"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { BulletinViewer } from "./BulletinViewer";

/** 최신 주보 쿼리 키 */
export const LATEST_BULLETIN_QUERY_KEY = ["bulletins", "latest"] as const;

/**
 * FR-BUL-01 — **페이지에 들어오면 최신 주보가 이미 열려 있다.**
 * 목록을 먼저 보여주고 고르게 하지 않는다 (SPEC_FUNCTIONAL §4.1: 매주 같은
 * 선택을 반복시키는 마찰). 지난 주보 목록은 뷰어 아래 보조 영역으로 붙는다.
 */
export function BulletinScreen() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: LATEST_BULLETIN_QUERY_KEY,
    queryFn: () => api.bulletins.latest(),
  });

  if (isLoading) {
    return <p className="text-[var(--color-gray-400)]">불러오는 중...</p>;
  }

  if (isError) {
    return (
      <p className="text-[var(--color-red-500)]">
        {isApiError(error) ? error.message : "주보를 불러오지 못했습니다."}
      </p>
    );
  }

  // SPEC_API §5.1 — 주보가 아직 없으면 `data: null`이 온다. 빈 뷰어를 그리지 않는다.
  if (!data) {
    return <p className="text-[var(--color-gray-400)]">아직 등록된 주보가 없습니다.</p>;
  }

  return <BulletinViewer bulletin={data} />;
}
