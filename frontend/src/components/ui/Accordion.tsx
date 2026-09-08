"use client";

import { useState, type ReactNode } from "react";

export interface AccordionItem {
  question: string;
  /**
   * 문자열이거나 블록 마크업이다.
   *
   * FAQ는 한 문장이면 되지만 `/worship`의 본당 예배 시간표는 경고 블록 +
   * `<table>`을 접어 넣는다. `string`이었을 때는 그게 안 됐다 — 아래 `<p>`
   * 래퍼를 조건부로 바꾼 것도 그래서다 (`<p>` 안에 `<table>`은 못 들어간다).
   */
  answer: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
}

/** 단일 개방형 아코디언 (FAQ 등) — 터치 타겟 44px 이상 유지 */
export function Accordion({ items }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <ul className="divide-y divide-[var(--color-navy-100)]">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <li key={item.question}>
            <button
              type="button"
              aria-expanded={isOpen}
              className="flex min-h-11 w-full items-center justify-between py-4 text-left font-bold"
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              <span>{item.question}</span>
              <span aria-hidden className="text-[var(--color-gray-400)]">
                {isOpen ? "▴" : "▾"}
              </span>
            </button>
            {isOpen && (
              <div className="pb-4 text-base leading-[1.7] text-[var(--color-gray-400)]">
                {typeof item.answer === "string" ? <p>{item.answer}</p> : item.answer}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
