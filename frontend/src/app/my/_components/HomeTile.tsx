import Link from "next/link";
import type { ReactNode } from "react";

const TILE_BASE =
  "flex min-h-24 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4 text-center transition";

interface HomeTileProps {
  icon: ReactNode;
  label: string;
  href: string;
  className?: string;
}

/**
 * `/my` 타일 그리드의 항목 하나.
 *
 * `href`가 없을 때 "준비 중" 비활성 타일을 그리는 분기가 있었는데, M3·M4에서
 * 모든 타일에 실제 라우트가 붙어 **도달할 수 없는 코드**가 됐다. 지금은
 * `href`를 필수로 두어 "준비 중" 타일이 필요해지면 타입 에러로 드러나게 한다.
 */
export function HomeTile({ icon, label, href, className = "" }: HomeTileProps) {
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
