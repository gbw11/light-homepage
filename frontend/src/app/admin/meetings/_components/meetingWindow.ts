/**
 * 월례회 열람 기간. 입력값 ↔ 서버 형식 변환은 회의록·예산안(§3.1)도 같이 써서
 * `@/lib/viewWindow`로 옮겼다 — 여기서는 그대로 다시 내보낸다.
 */
export { formatWindow, isoToLocalInput, localInputToIso } from "@/lib/viewWindow";

/**
 * 월례회 일자로부터 기본 열람 기간을 만든다 (WIREFRAME §21).
 * 기본값: 당일 20:00 ~ 이틀 뒤 23:59 — 월례회가 저녁에 열리고 주말 동안
 * 확인할 수 있게 하는 운영 패턴이다.
 */
export function defaultWindow(meetingDate: string): { from: string; until: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) return { from: "", until: "" };
  const [y, m, d] = meetingDate.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");

  const until = new Date(y, m - 1, d + 2);
  return {
    from: `${meetingDate}T20:00`,
    until: `${until.getFullYear()}-${pad(until.getMonth() + 1)}-${pad(until.getDate())}T23:59`,
  };
}
