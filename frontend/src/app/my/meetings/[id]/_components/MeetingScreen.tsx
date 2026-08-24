"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { MeetingUnavailable } from "./MeetingUnavailable";
import { MeetingViewer } from "./MeetingViewer";

/**
 * `/my/meetings/[id]`의 데이터·분기 담당 (SPEC_API §7.2).
 *
 * 열람 불가는 **두 가지 형태로 올 수 있어서 둘 다 다룬다**:
 *   1. `200` + `canView: false` + `viewReason`  ← §7.2 응답 스키마
 *   2. `FORBIDDEN` 예외                          ← §7.2 실패 표
 * 어느 쪽이 오든 §14b-3 화면을 띄운다. 둘 중 하나만 처리하면 백엔드 구현이
 * 다른 쪽을 고르는 순간 빈 화면이 된다.
 *
 * ⚠️ `canView`는 **UI 편의일 뿐 보안이 아니다.** 이걸 통과했다고 열람이
 * 허가된 게 아니고, 페이지 이미지를 보내는 서버가 매 요청마다 다시 검사한다
 * (§7.3 처리 순서 2). 그래서 뷰어는 이미지 실패(`onError`)를 정상 경로로
 * 취급한다.
 *
 * 캐시하지 않는다(`gcTime: 0`, `staleTime: 0`): 남은 시간·열람 가능 여부가
 * 지금 시점의 사실이어야 하고, 뒤로 갔다 돌아왔을 때 "아직 볼 수 있다"는
 * 낡은 응답을 보여주면 안 된다.
 */
export function MeetingScreen({ meetingId }: { meetingId: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["meetings", meetingId],
    queryFn: () => api.meetings.get(meetingId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  if (isLoading) {
    return <p className="text-[var(--color-gray-400)]">불러오는 중...</p>;
  }

  if (isError) {
    if (isApiError(error) && error.code === "FORBIDDEN") {
      return <MeetingUnavailable serverMessage={error.message} />;
    }
    if (isApiError(error) && error.code === "NOT_FOUND") {
      return (
        <div className="py-8 text-center">
          {/* 계속 유지되는 상태이므로 페이지 제목(h1)을 갖는다 */}
          <h1 className="font-bold text-[var(--color-red-500)]">
            찾을 수 없는 자료입니다.
          </h1>
          <p className="mt-4">
            <Link href="/my/meetings" className="font-bold underline">
              목록으로
            </Link>
          </p>
        </div>
      );
    }
    return (
      <p className="text-[var(--color-red-500)]">
        {isApiError(error) ? error.message : "자료를 불러오지 못했습니다."}
      </p>
    );
  }

  if (!data) return null;

  if (!data.canView) {
    return (
      <MeetingUnavailable
        title={data.title}
        status={data.status}
        viewableUntil={data.viewableUntil}
      />
    );
  }

  return <MeetingViewer detail={data} />;
}
