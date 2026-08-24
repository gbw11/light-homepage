"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

const MENU_LINKS = [
  { href: "/about", label: "소개" },
  { href: "/worship", label: "예배와 모임" },
  { href: "/sermons", label: "말씀" },
  { href: "/news", label: "소식" },
  { href: "/location", label: "오시는 길" },
];

/** WIREFRAME.md 공통 헤더/메뉴 · §11 `/my` 진입점 */
export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    setIsMenuOpen(false);
    router.push("/");
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between border-b border-[var(--color-navy-100)] bg-[var(--background)] px-5">
        <Link href="/" className="text-lg font-bold">
          LIGHT
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/welcome"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-4 text-sm font-bold text-[var(--color-navy-900)]"
          >
            처음이신가요
          </Link>
          <button
            type="button"
            aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isMenuOpen}
            className="flex min-h-11 min-w-11 items-center justify-center text-2xl"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {isMenuOpen && (
        <div className="fixed inset-0 z-30 flex flex-col bg-[var(--background)] px-5 pt-20">
          <nav className="flex flex-col gap-2">
            {MENU_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="min-h-11 py-2 text-lg font-bold"
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
            href="/welcome"
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] font-bold text-[var(--color-navy-900)]"
            onClick={() => setIsMenuOpen(false)}
          >
            처음 오시는 분
          </Link>

          <div className="mt-4 flex gap-4 text-sm text-[var(--color-gray-400)]">
            <a href="https://instagram.com" target="_blank" rel="noreferrer">
              ▸ Instagram
            </a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer">
              ▸ YouTube
            </a>
          </div>

          <hr className="my-6 border-[var(--color-navy-100)]" />

          {user ? (
            <div className="flex flex-col gap-2">
              <Link
                href="/my"
                className="min-h-11 py-2 text-base font-bold"
                onClick={() => setIsMenuOpen(false)}
              >
                👤 {user.name}님 · 나의 LIGHT
              </Link>
              <button
                type="button"
                className="min-h-11 py-2 text-left text-base text-[var(--color-gray-400)]"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="min-h-11 py-2 text-base text-[var(--color-gray-400)]"
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
