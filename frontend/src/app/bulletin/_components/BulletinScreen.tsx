"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { BulletinAdminBar } from "./BulletinAdminBar";
import { BulletinViewer, BulletinViewerSkeleton } from "./BulletinViewer";
import { PastBulletinList } from "./PastBulletinList";

/** 최신 주보 쿼리 키 */
const LATEST_BULLETIN_QUERY_KEY = ["bulletins", "latest"] as const;

/**
 * FR-BUL-01 — **페이지에 들어오면 최신 주보가 이미 열려 있다.**
 * 목록을 먼저 보여주고 고르게 하지 않는다 (SPEC_FUNCTIONAL §4.1: 매주 같은
 * 선택을 반복시키는 마찰). 지난 주보 목록은 뷰어 아래 보조 영역이다.
 *
 * 지난 주보를 고르면 **라우팅하지 않고** 위 뷰어의 내용만 교체한다
 * (`bulletins.get`, SPEC_API §5.3). URL을 바꾸지 않기로 한 이유: 뒤로 가기가
 * "주보 목록"이 아니라 "이전에 보던 주보"로 돌아가는 편이 이 화면의 기본값
 * (최신 주보가 열려 있음)을 흔들지 않는다. 특정 주보를 공유해야 할 필요가
 * 생기면 `?id=`를 얹는 별도 단위로 다룬다.
 */
export function BulletinScreen() {
  const latestQuery = useQuery({
    queryKey: LATEST_BULLETIN_QUERY_KEY,
    queryFn: () => api.bulletins.latest(),
  });

  /** 사용자가 지난 주보를 고른 경우에만 값이 있다. null이면 최신 주보. */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedQuery = useQuery({
    queryKey: ["bulletins", selectedId],
    queryFn: () => api.bulletins.get(selectedId as string),
    enabled: selectedId !== null,
  });

  if (latestQuery.isLoading) {
    // 한 줄 텍스트를 두면 뷰어가 도착할 때 아래가 통째로 밀린다 (CLS 0.278)
    return <BulletinViewerSkeleton />;
  }

  if (latestQuery.isError) {
    return (
      <p className="text-[var(--color-red-500)]">
        {isApiError(latestQuery.error)
          ? latestQuery.error.message
          : "주보를 불러오지 못했습니다."}
      </p>
    );
  }

  const latest = latestQuery.data;

  // SPEC_API §5.1 — 주보가 아직 없으면 `data: null`이 온다. 빈 뷰어를 그리지 않는다.
  if (!latest) {
    return (
      <div>
        {/* 주보가 없을 때야말로 임원에게 업로드 경로가 필요하다 */}
        <BulletinAdminBar bulletin={null} onDeleted={() => setSelectedId(null)} />
        <p className="text-[var(--color-gray-400)]">아직 등록된 주보가 없습니다.</p>
      </div>
    );
  }

  const shown = selectedId === null ? latest : selectedQuery.data;

  return (
    <div>
      <BulletinAdminBar
        bulletin={shown ? { id: shown.id, serviceDate: shown.serviceDate } : null}
        // 지금 보던 주보가 사라졌으므로 최신 주보로 돌아간다
        onDeleted={() => setSelectedId(null)}
      />

      {shown ? (
        // 주보가 바뀌면 뷰어 상태(현재 장)를 처음부터 시작해야 한다
        <BulletinViewer key={shown.id} bulletin={shown} />
      ) : selectedQuery.isError ? (
        <p className="text-[var(--color-red-500)]">
          {isApiError(selectedQuery.error)
            ? selectedQuery.error.message
            : "주보를 불러오지 못했습니다."}
        </p>
      ) : (
        // 지난 주보를 고른 직후에도 같은 자리를 유지한다
        <BulletinViewerSkeleton />
      )}

      <div className="mt-12">
        <PastBulletinList
          selectedId={shown?.id ?? latest.id}
          onSelect={(id) => setSelectedId(id === latest.id ? null : id)}
        />
      </div>
    </div>
  );
}
