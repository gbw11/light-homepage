"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { CHURCH_PHONE } from "@/content/contact";
import { INSTAGRAM_URL, YOUTUBE_CHANNEL_URL } from "@/content/links";

const MENU_LINKS = [
  { href: "/about", label: "소개" },
  { href: "/worship", label: "예배와 모임" },
  { href: "/sermons", label: "말씀" },
  { href: "/news", label: "소식" },
  { href: "/location", label: "오시는 길" },
];

/**
 * 자료 화면 — 공개 열람 전환(PM 결정 2026-08-25)으로 로그인 없이 볼 수 있게
 * 되면서, 여기가 **유일한 진입 경로**가 됐다. 예전에는 `/my` 홈의 타일이
 * 그 역할을 했지만 지금 `/my`는 로그인한 사람의 개인 화면이다.
 *
 * 공지는 여기 없다 — 위 주요 메뉴의 "소식"(`/news`)이 공지 전체를 담는다
 * (공지 통합, PM 결정 2026-08-25). 회의록(`/documents`)은 넣는다: 예산안 탭만
 * 임원에게 보이고 회의록 자체는 공개다.
 * 색인은 계속 막혀 있으므로(robots.ts) 검색으로는 여전히 안 나온다.
 */
const RESOURCE_LINKS = [
  { href: "/bulletin", label: "주보" },
  { href: "/photos", label: "사진첩" },
  { href: "/meetings", label: "월례회 자료" },
  { href: "/documents", label: "회의록" },
];

const MENU_ID = "site-menu";

/** WIREFRAME.md 공통 헤더/메뉴 · §11 `/my` 진입점 */
export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
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
   * (`app/photos/[id]/_components/Lightbox.tsx`) — 같은 동작이 화면마다
   * 다르게 느껴지지 않게 한다.
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

      // 열려 있는 동안 Tab은 [메뉴 열기/닫기 버튼 + 패널] 안에서만 돈다.
      // 뒤에 가려진 페이지 본문으로 포커스가 새면 보이지 않는 곳을 훑게 된다.
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

  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between border-b border-[var(--color-navy-100)] bg-[var(--background)] px-5">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-lg font-bold"
        >
          LIGHT
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/welcome"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-4 text-sm font-bold text-[var(--color-accent-fg)]"
          >
            처음이신가요
          </Link>
          {/*
            문의 진입점 (PM 결정 2026-08-25). `tel:`로 곧장 걸지 않고
            `/contact`로 보낸다 — 데스크톱에는 전화 앱이 없어 `tel:`이
            아무 반응도 없고 번호를 눈으로 볼 수도 없다.
            아이콘만 두므로 `aria-label`이 유일한 이름이다.
          */}
          <Link
            href="/contact"
            aria-label="문의"
            title="문의"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-xl transition hover:bg-[var(--color-navy-100)]"
          >
            <span aria-hidden>☎</span>
          </Link>
          <button
            ref={toggleRef}
            type="button"
            aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isMenuOpen}
            aria-controls={MENU_ID}
            className="flex min-h-11 min-w-11 items-center justify-center text-2xl"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {isMenuOpen && (
        <div
          ref={panelRef}
          id={MENU_ID}
          role="dialog"
          aria-modal="true"
          aria-label="전체 메뉴"
          className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-[var(--background)] px-5 pt-20"
        >
          <nav aria-label="주요 메뉴" className="flex flex-col gap-2">
            {MENU_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center py-2 text-lg font-bold"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <hr className="my-6 border-[var(--color-navy-100)]" />

          <nav aria-label="자료" className="flex flex-col gap-1">
            <h2 className="mb-1 text-sm font-bold text-[var(--color-gray-400)]">자료</h2>
            {RESOURCE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center py-1 text-base font-bold"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <hr className="my-6 border-[var(--color-navy-100)]" />

          <p className="text-base text-[var(--color-gray-400)]">
            주일 14:00 · 드림센터 4층
          </p>
          <Link
            href="/contact"
            className="mt-2 inline-flex min-h-11 items-center text-base text-[var(--color-gray-400)]"
            onClick={() => setIsMenuOpen(false)}
          >
            ☎ 문의 · {CHURCH_PHONE}
          </Link>
          <Link
            href="/welcome"
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] font-bold text-[var(--color-accent-fg)]"
            onClick={() => setIsMenuOpen(false)}
          >
            처음 오시는 분
          </Link>

          {/* 주소를 모르는 항목은 그리지 않는다 — `content/links.ts` 주석 참고 */}
          <div className="mt-4 flex gap-4 text-sm text-[var(--color-gray-400)]">
            {INSTAGRAM_URL && (
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center"
              >
                ▸ Instagram
              </a>
            )}
            <a
              href={YOUTUBE_CHANNEL_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center"
            >
              ▸ YouTube
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
