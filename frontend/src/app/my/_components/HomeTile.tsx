import Link from "next/link";
import type { ReactNode } from "react";

const TILE_BASE =
  "flex min-h-24 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4 text-center transition";

interface HomeTileProps {
  icon: ReactNode;
  label: string;
  href?: string;
  className?: string;
}

/**
 * `/my` 타일 그리드의 항목 하나. `href`가 있으면 이동 가능한 타일, 없으면
 * "준비 중" 비활성 타일이다 (news 페이지 갤러리 탭 패턴과 동일 —
 * `frontend/src/app/news/page.tsx`).
 */
export function HomeTile({ icon, label, href, className = "" }: HomeTileProps) {
  if (!href) {
    return (
      <button
        type="button"
        disabled
        title={`${label}은(는) 준비 중입니다`}
        className={`${TILE_BASE} text-[var(--color-gray-400)] ${className}`}
      >
        <span className="text-2xl" aria-hidden>
          {icon}
        </span>
        <span className="text-sm font-bold">{label}</span>
        <span className="text-xs">준비 중</span>
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={`${TILE_BASE} hover:bg-[var(--color-navy-100)]/40 ${className}`}
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="text-sm font-bold">{label}</span>
    </Link>
  );
}
