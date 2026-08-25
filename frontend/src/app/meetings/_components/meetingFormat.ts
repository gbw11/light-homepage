import type { MeetingStatus } from "@/types/api";

/**
 * 목록·뷰어가 같은 표기를 쓰기 위한 표시 전용 헬퍼들.
 *
 * ⚠️ **여기 있는 계산은 전부 "표시"다. 열람 가능 여부 판정이 아니다.**
 * 기간 판정은 서버만 한다 (SPEC_FUNCTIONAL §6.2 FR-MTG-02/05 — 프론트에서
 * 날짜를 계산해 숨기는 방식은 우회 가능하다). 화면은 서버가 준
 * `status`·`canView`만 믿고, 아래 함수들은 그걸 사람이 읽을 문장으로
 * 바꾸는 데만 쓴다.
 */

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  SCHEDULED: "열람 예정",
  OPEN: "열람 가능",
  CLOSED: "종료됨",
};

/** 상태 점 — 와이어프레임 §14b-1의 `🟢`/`⚫` 표기를 따른다 */
export const MEETING_STATUS_DOT: Record<MeetingStatus, string> = {
  SCHEDULED: "🕓",
  OPEN: "🟢",
  CLOSED: "⚫",
};

/** `2026-08-24`(LocalDate) → `8/24`. 시간대 해석이 끼지 않게 문자열을 그대로 쪼갠다 */
export function formatMeetingDate(localDate: string): string {
  const [, month, day] = localDate.split("-");
  if (!month || !day) return localDate;
  return `${Number(month)}/${Number(day)}`;
}

/** ISO(UTC) → `8/26 23:59` — 사용자 기기의 로컬 시간으로 보여준다 */
export function formatDeadline(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

/**
 * 남은 초 → `2일 3시간 남음`.
 *
 * 단위를 두 개까지만 보여준다 — `2일 3시간 12분 40초`는 "얼마 남았나"를
 * 오히려 읽기 어렵게 한다. 1분 미만에서만 초를 노출해 "지금 끝난다"가
 * 눈에 들어오게 한다.
 */
export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "열람 기간이 끝났습니다";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) return `${days}일 ${hours}시간 남음`;
  if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
  if (minutes > 0) return `${minutes}분 ${secs}초 남음`;
  return `${secs}초 남음`;
}

/** 표시용 남은 초. 목록 응답에는 `remainingSeconds`가 없어 마감시각으로 계산한다 */
export function secondsUntil(iso: string): number {
  const until = new Date(iso).getTime();
  if (Number.isNaN(until)) return 0;
  return Math.max(0, Math.floor((until - Date.now()) / 1000));
}
