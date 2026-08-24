import type { ReactNode } from "react";

interface SectionProps {
  title?: string;
  /**
   * 제목 태그. 기본은 `h2` — 페이지 안의 한 섹션 제목이라는 뜻이다.
   * 그 섹션 제목이 곧 페이지 제목인 화면(로그인·회원가입 등)에서는 `h1`로
   * 올려서 페이지마다 h1이 정확히 하나 있게 한다 (SPEC_NONFUNCTIONAL.md §6).
   */
  titleAs?: "h1" | "h2";
  children: ReactNode;
  className?: string;
}

/** 컨테이너 max-w 1200px, 섹션 여백 64/96 (ARCHITECTURE.md §11) */
export function Section({
  title,
  titleAs: Heading = "h2",
  children,
  className = "",
}: SectionProps) {
  return (
    <section
      className={`mx-auto w-full max-w-[var(--container-max)] px-5 py-16 md:px-10 md:py-24 ${className}`}
    >
      {title && <Heading className="mb-6 text-xl font-bold md:text-2xl">{title}</Heading>}
      {children}
    </section>
  );
}
