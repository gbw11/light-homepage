/**
 * 열람 기간 입력값 ↔ 서버 형식 변환 — 월례회(SPEC_API §7)와 회의록·예산안(§3.1)이 같이 쓴다.
 *
 * 서버는 ISO-8601 UTC(`2026-08-24T11:00:00Z`)를 주고받는데(SPEC_API §1),
 * `<input type="datetime-local">`은 **현지 시각 문자열**(`2026-08-24T20:00`)을
 * 다룬다. 이 둘을 섞어 쓰면 화면에는 20:00으로 보이는데 서버에는 20:00Z가
 * 저장돼 한국 기준으로 9시간 어긋난다 — 열람 기간이 이 기능의 통제 수단
 * 자체라 그 어긋남이 곧 "못 봐야 할 때 보인다"가 된다.
 * 그래서 경계를 이 파일 하나로 모은다.
 */

/** `<input type="datetime-local">` 값 → ISO-8601 UTC */
export function localInputToIso(value: string): string {
  // `new Date("2026-08-24T20:00")`은 현지 시각으로 해석된다 — 그게 우리가 원하는 것이다
  return new Date(value).toISOString();
}

/** ISO-8601 UTC → `<input type="datetime-local">` 값 (현지 시각) */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO(UTC) → `8/26 23:59` — 사용자 기기의 로컬 시간으로 보여준다 */
export function formatDeadline(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

/** 사람이 읽는 기간 문자열 — 관리 화면 여러 곳에서 같은 모양이어야 한다 */
export function formatWindow(fromIso: string, untilIso: string): string {
  return `${formatDeadline(fromIso)} ~ ${formatDeadline(untilIso)}`;
}
