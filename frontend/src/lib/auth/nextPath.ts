/**
 * 로그인 후 돌아갈 주소(`/login?next=...`) — USERFLOW_AUDIT 2026-10-07 🔵-1.
 *
 * ⚠️ `next`는 누구나 링크에 심을 수 있는 값이다. 검사 없이 이동하면
 * `/login?next=https://악성사이트`로 로그인 직후 외부로 보내는 오픈 리다이렉트가
 * 된다. 그래서 **이 사이트 안의 경로만** 받는다:
 *   · `/` 하나로 시작해야 한다 — `//evil.com`(프로토콜 상대 주소)은 거부
 *   · 역슬래시는 어디에도 없어야 한다 — 브라우저가 `/\evil.com`을 `//evil.com`으로 읽는다
 *   · 제어 문자·공백 문자가 없어야 한다 — 탭·개행을 끼워 검사를 피하는 수법 차단
 * 통과하지 못하면 null — 부르는 쪽이 기본 목적지(`/my`)로 간다.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("\\")) return null;
  if (/[\u0000-\u001F\u007F\s]/.test(raw)) return null;
  // 마지막 방어선 — 실제로 같은 출처로 풀리는지 URL 파서에 한 번 더 묻는다
  try {
    const base = "https://light.invalid";
    if (new URL(raw, base).origin !== base) return null;
  } catch {
    return null;
  }
  return raw;
}

/** 게이트가 로그인 화면으로 보낼 때 쓰는 주소. 지금 경로를 `next`로 싣는다 */
export function loginHref(currentPath: string | null | undefined): string {
  const next = safeNextPath(currentPath);
  if (!next || next === "/login" || next.startsWith("/login?")) return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}
