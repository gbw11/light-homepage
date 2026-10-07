import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

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
  /**
   * 다른 화면에서 이 섹션으로 곧장 링크할 때만 준다 (`/location#parking`).
   * 값은 **영문**으로 둔다 — 한글 id는 주소창에서 퍼센트 인코딩으로 늘어져
   * 링크를 눈으로 확인하기 어렵다.
   */
  id?: string;
  /** 제목을 스크롤 등장 애니메이션으로 띄운다 (`Reveal`). 본문은 호출부가 감싼다 */
  revealTitle?: boolean;
}

/** 컨테이너 max-w 1200px, 섹션 여백 64/96 (ARCHITECTURE.md §11) */
export function Section({
  title,
  titleAs: Heading = "h2",
  children,
  className = "",
  id,
  revealTitle = false,
}: SectionProps) {
  const heading = title && (
    <Heading className="mb-6 text-xl font-bold md:text-2xl">{title}</Heading>
  );
  return (
    <section
      id={id}
      className={`mx-auto w-full max-w-[var(--container-max)] px-5 py-16 md:px-10 md:py-24 ${className}`}
    >
      {heading && (revealTitle ? <Reveal>{heading}</Reveal> : heading)}
      {children}
    </section>
  );
}
