/**
 * 생년월일 입력 — 새가족 등록(`/welcome/register`, SPEC_API §9.1)이 쓴다.
 *
 * 서버 규칙(§9.1): `YYYY-MM-DD` · 달력에 있는 날짜 · 미래 아님 · 1900년 이후.
 * 이 넷을 보내기 전에 막아, 서버 400을 받아서야 고치게 하지 않는다.
 */

/** 2001-13-45처럼 형식만 맞고 달력에 없는 날짜를 거른다 (서버 `LocalDate.parse`와 같은 판단) */
export function isCalendarDate(v: string): boolean {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** 한국 날짜 기준 오늘 (`YYYY-MM-DD`). 자정 직후 UTC로 비교하면 하루가 밀린다 */
function todayInSeoul(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * 생년월일 칸의 문제를 문구로 돌려준다. 문제가 없으면 `null`.
 * 문자열 비교가 날짜 비교와 같다 — 둘 다 `YYYY-MM-DD`라서.
 */
export function birthDateProblem(v: string, now: Date = new Date()): string | null {
  if (!v) return "생년월일을 입력해주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "생년월일을 YYYY-MM-DD 형식으로 입력해주세요.";
  if (!isCalendarDate(v) || v < "1900-01-01" || v > todayInSeoul(now)) {
    return "생년월일을 확인해주세요.";
  }
  return null;
}

/**
 * 숫자만 눌러도 `2001-03-14` 모양이 되게 대시를 붙인다 (앱 새가족 폼과 같은 입력).
 * 숫자가 아닌 글자는 버리고 8자리에서 자른다.
 */
export function formatBirthDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}
