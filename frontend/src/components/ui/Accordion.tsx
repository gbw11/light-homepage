"use client";

import { useState } from "react";

export interface AccordionItem {
  question: string;
  answer: string;
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
              <p className="pb-4 text-base leading-[1.7] text-[var(--color-gray-400)]">
                {item.answer}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
