import type { ReactNode } from "react";

interface SectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

/** 컨테이너 max-w 1200px, 섹션 여백 64/96 (ARCHITECTURE.md §11) */
export function Section({ title, children, className = "" }: SectionProps) {
  return (
    <section
      className={`mx-auto w-full max-w-[var(--container-max)] px-5 py-16 md:px-10 md:py-24 ${className}`}
    >
      {title && <h2 className="mb-6 text-xl font-bold md:text-2xl">{title}</h2>}
      {children}
    </section>
  );
}
