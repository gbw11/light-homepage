"use client";

import Link from "next/link";
import { YOUTH_SERVICE_LINE } from "@/content/worship";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { CHURCH_PHONE } from "@/content/contact";
import { INSTAGRAM_URL, YOUTUBE_CHANNEL_URL } from "@/content/links";
import { MENU_LINKS, RESOURCE_LINKS } from "./navigation";
import { NotificationBell } from "./NotificationBell";

const MENU_ID = "site-menu";
const RESOURCE_MENU_ID = "site-menu-resources";

/**
 * 공통 헤더 (WIREFRAME.md · §11 `/my` 진입점).
 *
 * ## 뼈대를 모교회 사이트에 맞춘다 (PM 요청 2026-09-01)
 *
 * 김해교회(`gloria.or.kr`)는 **어두운 띠 + 왼쪽 워드마크 + 가운데 가로 메뉴 +
 * 오른쪽 위 로그인** 구조다. 우리도 데스크톱에서 같은 뼈대로 간다 — 모교회에서
 * 넘어온 방문자가 같은 자리에서 같은 모양을 본다.
 *
 * **색은 우리 팔레트를 쓴다.** 저쪽은 딥그린(#09403A)이지만, 우리는 오늘 PM이
 * 정한 STUDIO FLEUR의 딥카롭(`--color-navy-900`)이 그 자리를 맡는다
 * (`DECISIONS.md` 2026-09-01). 뼈대를 맞추는 것과 색을 베끼는 것은 다른 일이다.
 *
 * ## 데스크톱과 모바일이 다르다
 *
 * · `lg` 이상 — 가로 메뉴 (하위 항목은 hover/focus로 펼침)
 * · `lg` 미만 — 햄버거 → 전체 화면 메뉴 (기존 동작 그대로)
 *
 * 저쪽도 좁은 화면에서는 햄버거로 접힌다. 가로 메뉴를 모바일에 그대로 두면
 * 5개 항목이 두 줄로 깨지고 터치 영역이 44px 아래로 내려간다 (NFR-A11Y-05).
 */
export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isResourceOpen, setIsResourceOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = async () => {
    await logout();
    setIsMenuOpen(false);
    router.push("/");
  };

  /**
   * 메뉴는 화면 전체를 덮는 불투명 패널이다 — 즉 시각적으로는 모달이므로
   * 키보드에도 모달처럼 동작해야 한다 (NFR-A11Y-06 / -09).
   * 포커스 트랩·Escape 규칙은 라이트박스와 같은 패턴을 쓴다
   * (`app/photos/[id]/_components/Lightbox.tsx`).
   */
  useEffect(() => {
    if (!isMenuOpen) return;

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a[href], button")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsMenuOpen(false);
        // 열었던 버튼으로 포커스를 되돌린다 — 안 하면 body로 떨어져서
        // 다음 Tab이 페이지 맨 처음부터 다시 시작한다
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = [
        toggleRef.current,
        ...Array.from(
          panel?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        ),
      ].filter((el): el is HTMLElement => Boolean(el));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  /** 현재 화면이 이 메뉴 아래인가 — 저쪽처럼 활성 항목에 밑줄을 준다 */
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  /**
   * CTA는 로그인 상태를 따라간다. 로그인한 회원에게 "처음이신가요"가 계속 떠
   * 있으면 자기 자리로 가는 가장 큰 버튼이 방문자용 안내가 된다.
   * `isLoading` 동안에는 방문자용을 그린다 — 비워두면 헤더 폭이 흔들린다.
   */
  const signedIn = Boolean(user) && !isLoading;

  return (
    <>
      {/*
        아래 경계선 — 홈 Hero가 헤더와 **같은 토큰**(`--color-navy-900`)을
        배경으로 써서, 선이 없으면 둘이 한 덩어리로 붙어 보인다. 모교회
        사이트는 Hero가 사진이라 이 문제가 없다.
      */}
      <header className="sticky top-0 z-40 border-b border-white/15 bg-[var(--color-navy-900)] text-white">
        {/*
          **한 줄** 배치 (PM 요청 2026-09-01) — 워드마크 · 가로 메뉴 · 로그인이
          같은 줄에 온다. 2행으로 나눴더니 헤더가 세로로 길어 본문을 밀어냈다.

          메뉴는 `flex-1`로 남는 폭을 먹고 오른쪽으로 붙는다 — 항목이 늘어도
          워드마크·로그인을 밀지 않고 자기들끼리 좁아진다.
        */}
        <div className="mx-auto flex min-h-14 w-full max-w-[var(--container-max)] items-center gap-2 px-5">
          {/*
            워드마크는 **녹색 계열**로 둔다 (PM 2026-09-02) — LIGHT의 원래 로고가
            녹색이다. 갈색 띠(`--color-navy-900`) 위에 얹으므로 스킴을 따라
            뒤집지 않는 `--color-accent-on-dark`(#b3b792 세이지)를 쓴다.
            대비 4.73:1 — WCAG AA 통과 (흰색은 9.82:1이었다).
            홈 Hero의 아크로스틱 첫 글자도 같은 토큰이라 색이 맞물린다.
          */}
          <Link
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center text-lg font-bold text-[var(--color-accent-on-dark)]"
          >
            LIGHT
          </Link>

          {/* ── 가로 메뉴 (데스크톱만) ─────────────────────────────── */}
          <nav aria-label="주요 메뉴" className="hidden flex-1 lg:block">
            <ul className="flex items-center justify-end">
              {MENU_LINKS.map((item) => (
                <li key={item.href} className="group relative">
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-bold transition ${
                      isActive(item.href)
                        ? "border-[var(--color-accent-on-dark)] text-[var(--color-accent-on-dark)]"
                        : "border-transparent hover:border-white/40"
                    }`}
                  >
                    {item.label}
                  </Link>

                  {/*
                    하위 메뉴 — 모교회처럼 상위 항목 아래로 펼친다.
                    hover만으로 열면 키보드 사용자가 닿지 못하므로 포커스로도
                    열어야 한다 (NFR-A11Y).

                    ⚠️ 전에는 `group-focus-within`이었는데, **마우스로 상위 항목을
                    누르면 링크에 포커스가 남아 메뉴를 벗어나도 목록이 열린 채로
                    있었다** (PM 지적 2026-09-02). hover가 풀렸는데도 focus-within이
                    계속 참이기 때문이다.

                    `group-has-[:focus-visible]`로 바꿔 **키보드 포커스일 때만**
                    열어둔다. 브라우저는 Tab 이동에는 `:focus-visible`을 주고
                    마우스 클릭에는 주지 않으므로, 키보드 접근성은 그대로면서
                    마우스를 옮기면 닫힌다.
                  */}
                  {item.children && (
                    <ul className="invisible absolute left-0 top-full z-50 min-w-44 rounded-b-[var(--radius-card)] bg-[var(--color-navy-900)] py-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-has-[:focus-visible]:visible group-has-[:focus-visible]:opacity-100">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className="flex min-h-11 items-center whitespace-nowrap px-4 text-sm transition hover:bg-white/10"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}

              {/*
                자료 — 회원 전용이라 공개 메뉴와 구분해 맨 끝에 둔다.

                ⚠️ 트리거가 **버튼이어야 한다.** 다른 항목은 상위가 링크라
                포커스를 받고 `group-focus-within`으로 하위가 열리는데, 자료는
                갈 페이지가 없다. `<span>`으로 두면 포커스를 못 받고,
                하위 항목은 `invisible`이라 탭 순서에서 빠져 있어서
                **키보드로는 영영 열 수 없다** (NFR-A11Y-06).
              */}
              {/*
                ⚠️ `자료`는 클릭 토글(`isResourceOpen`)이라, 한 번 누르면 마우스를
                옮겨도 열린 채로 남았다 (PM 지적 2026-09-02). 포인터가 항목을
                떠나면 닫는다 — 다른 상위 메뉴가 hover로 닫히는 것과 같은 감각이다.
                키보드로 연 경우는 마우스가 들어올 일이 없어 영향받지 않는다.
              */}
              <li
                className="group relative ml-1 border-l border-white/20 pl-1"
                onMouseLeave={() => setIsResourceOpen(false)}
              >
                <button
                  type="button"
                  aria-expanded={isResourceOpen}
                  aria-controls={RESOURCE_MENU_ID}
                  onClick={() => setIsResourceOpen((open) => !open)}
                  className="inline-flex min-h-11 items-center whitespace-nowrap px-3 text-sm font-bold text-white/80 transition hover:text-white"
                >
                  자료 ▾
                </button>
                <ul
                  id={RESOURCE_MENU_ID}
                  className={`absolute right-0 top-full z-50 min-w-44 rounded-b-[var(--radius-card)] bg-[var(--color-navy-900)] py-2 shadow-lg transition group-hover:visible group-hover:opacity-100 ${
                    isResourceOpen ? "visible opacity-100" : "invisible opacity-0"
                  }`}
                >
                  {RESOURCE_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        /*
                          클라이언트 이동은 이 컴포넌트를 다시 만들지 않아
                          `isResourceOpen`이 그대로 남는다 — 도착한 화면에서도
                          목록이 펼쳐진 채로 보인다. 눌렀으면 닫는다.
                        */
                        onClick={() => setIsResourceOpen(false)}
                        className="flex min-h-11 items-center whitespace-nowrap px-4 text-sm transition hover:bg-white/10"
                      >
                        🔒 {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>

          {/* ── 오른쪽 고정 항목 ───────────────────────────────────── */}
          <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-2">
            {/*
              문의 진입점 (PM 결정 2026-08-25). `tel:`로 곧장 걸지 않고
              `/contact`로 보낸다 — 데스크톱에는 전화 앱이 없어 `tel:`이
              아무 반응도 없고 번호를 눈으로 볼 수도 없다.
            */}
            <Link
              href="/contact"
              aria-label={`문의 ${CHURCH_PHONE}`}
              title="문의"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-xl transition hover:bg-white/10"
            >
              <span aria-hidden>☎</span>
            </Link>

            {/* 임원(L) 이상에게만 보인다 — 컴포넌트 내부에서 role 체크 후 null 반환 (§14, FE-1) */}
            <NotificationBell />

            <Link
              href={signedIn ? "/my" : "/login"}
              className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-button)] px-3 text-sm font-bold transition hover:bg-white/10"
            >
              <span aria-hidden>{signedIn ? "👤" : "🔒"}</span>
              {signedIn ? "나의 LIGHT" : "로그인"}
            </Link>

            {/*
              로그아웃 (PM 요청 2026-09-02) — 전에는 `/my`까지 들어가야 나갈 수
              있었다. 로그인은 헤더 오른쪽 한 번인데 로그아웃은 두 단계라
              대칭이 맞지 않았다.

              ⚠️ **데스크톱만이다** (`hidden lg:inline-flex`). 모바일 헤더는
              워드마크·☎·나의 LIGHT·햄버거가 이미 한 줄을 채워서, 여기에 글자를
              더 넣으면 44px 터치 영역이 서로 붙는다 (NFR-A11Y-05). 좁은 화면의
              로그아웃은 아래 전체 메뉴에 그대로 있다.

              링크가 아니라 `button`이다 — 이동이 아니라 상태를 바꾸는 동작이고,
              `handleLogout`이 세션을 비운 뒤 홈으로 보낸다.
            */}
            {signedIn && (
              /*
                ⚠️ 감추기를 버튼이 아니라 **감싼 span이 맡는다.** 버튼에
                `hidden lg:inline-flex`를 직접 걸었더니 `lg:inline-flex` 규칙이
                CSS에 생성되지 않아 `hidden`만 남고 데스크톱에서도 안 보였다
                (실측: `getComputedStyle().display === "none"`). 이 파일이 이미
                쓰는 `hidden lg:block`으로 바꿔 같은 문제를 피한다.
              */
              <span className="hidden lg:block">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-[var(--radius-button)] px-3 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  로그아웃
                </button>
              </span>
            )}

            {/* 가로 메뉴가 있는 화면에서는 햄버거를 감춘다 */}
            <button
              ref={toggleRef}
              type="button"
              aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={isMenuOpen}
              aria-controls={MENU_ID}
              className="flex min-h-11 min-w-11 items-center justify-center text-2xl lg:hidden"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              {isMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </header>

      {/* ── 모바일 전체 메뉴 ─────────────────────────────────────── */}
      {isMenuOpen && (
        <div
          ref={panelRef}
          id={MENU_ID}
          role="dialog"
          aria-modal="true"
          aria-label="전체 메뉴"
          className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-[var(--background)] px-5 pt-20 lg:hidden"
        >
          <nav aria-label="주요 메뉴" className="flex flex-col gap-2">
            {MENU_LINKS.map((item) => (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center py-2 text-lg font-bold"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
                {item.children && (
                  <div className="ml-3 flex flex-col border-l border-[var(--color-navy-100)] pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="inline-flex min-h-11 items-center text-base text-[var(--color-gray-400)]"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <hr className="my-6 border-[var(--color-navy-100)]" />

          <nav aria-label="자료" className="flex flex-col gap-1">
            <h2 className="mb-1 text-sm font-bold text-[var(--color-gray-400)]">
              자료 · 회원 전용
            </h2>
            {RESOURCE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center py-1 text-base font-bold"
                onClick={() => setIsMenuOpen(false)}
              >
                🔒 {link.label}
              </Link>
            ))}
          </nav>

          <hr className="my-6 border-[var(--color-navy-100)]" />

          <p className="text-base text-[var(--color-gray-400)]">{YOUTH_SERVICE_LINE}</p>
          <Link
            href="/contact"
            className="mt-2 inline-flex min-h-11 items-center text-base text-[var(--color-gray-400)]"
            onClick={() => setIsMenuOpen(false)}
          >
            ☎ 문의 · {CHURCH_PHONE}
          </Link>

          {/* 로그인한 회원에게는 감춘다 — 아래에 "나의 LIGHT"가 있다 */}
          {!user && (
            <Link
              href="/welcome"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] font-bold text-[var(--color-accent-fg)]"
              onClick={() => setIsMenuOpen(false)}
            >
              처음 오시는 분
            </Link>
          )}

          {/* 주소를 모르는 항목은 그리지 않는다 — `content/links.ts` 주석 참고 */}
          <div className="mt-4 flex gap-4 text-sm text-[var(--color-gray-400)]">
            {INSTAGRAM_URL && (
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5"
              >
                <span aria-hidden>📷</span> Instagram
              </a>
            )}
            <a
              href={YOUTUBE_CHANNEL_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5"
            >
              <span aria-hidden>▶️</span> YouTube
            </a>
          </div>

          <hr className="my-6 border-[var(--color-navy-100)]" />

          {user ? (
            <div className="flex flex-col gap-2">
              <Link
                href="/my"
                className="inline-flex min-h-11 items-center py-2 text-base font-bold"
                onClick={() => setIsMenuOpen(false)}
              >
                👤 {user.name}님 · 나의 LIGHT
              </Link>
              <button
                type="button"
                className="inline-flex min-h-11 items-center py-2 text-left text-base text-[var(--color-gray-400)]"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center py-2 text-base text-[var(--color-gray-400)]"
              onClick={() => setIsMenuOpen(false)}
            >
              🔒 로그인 / 회원가입
            </Link>
          )}
        </div>
      )}
    </>
  );
}
