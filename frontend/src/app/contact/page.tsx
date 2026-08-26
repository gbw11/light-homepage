import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { CHURCH_PHONE, CHURCH_PHONE_TEL } from "@/content/contact";

export const metadata: Metadata = {
  title: "문의",
  description:
    "김해교회 청년교회 LIGHT 문의처. 청년예배 주일 14:00 드림센터 4층. 전화 055-333-6321.",
};

/**
 * 문의 `/contact` (PM 결정 2026-08-25 — 상단 내비바에 전화 진입점).
 *
 * 상단바에서 `tel:`로 곧장 발신하지 않고 이 화면을 거치는 이유:
 * **데스크톱에는 전화 앱이 없다.** `tel:` 링크는 눌러도 아무 반응이 없거나
 * 알 수 없는 앱 선택 창을 띄우고, 무엇보다 번호를 눈으로 볼 수가 없다.
 * 화면을 하나 두면 모바일은 [전화하기]로 바로 걸고, 데스크톱은 번호를 읽어
 * 다른 기기로 걸 수 있다. 나중에 카카오톡·이메일이 정해지면 붙일 자리도 된다.
 */
export default function ContactPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">문의</h1>
        <p className="mt-2 text-[var(--color-gray-400)]">
          궁금한 점이 있으면 편하게 연락 주세요.
        </p>

        <div className="mt-8 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-6">
          <p className="text-sm font-bold text-[var(--color-gray-400)]">전화</p>

          {/*
            번호를 링크 안의 텍스트로 그대로 노출한다 — 데스크톱에서 `tel:`이
            동작하지 않아도 눈으로 읽고 다른 기기로 걸 수 있어야 한다.
            아이콘만 있는 버튼이면 그게 불가능하다.
          */}
          <a
            href={`tel:${CHURCH_PHONE_TEL}`}
            className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-lg font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
          >
            <span aria-hidden>☎</span>
            {CHURCH_PHONE}
          </a>

          {/*
            ⚠️ 이 번호는 청년부 직통이 아니라 교회 사무실이다 (PLAN.md §1.4).
            그걸 적지 않으면 "청년부에 걸었는데 왜 사무실이 받지" 하고 당황한다.
          */}
          <p className="mt-4 text-sm text-[var(--color-gray-400)]">
            김해교회 사무실로 연결됩니다. 청년교회 담당자를 찾으신다고 말씀해
            주세요. 평일 낮에 연락하시면 가장 빠릅니다.
          </p>
        </div>

        <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-6">
          <p className="text-sm font-bold text-[var(--color-gray-400)]">직접 찾아오시려면</p>
          <p className="mt-3 text-base font-bold">주일 14:00 · 드림센터 4층</p>
          <p className="mt-1 text-sm text-[var(--color-gray-400)]">
            드림센터는 본당과 별개 건물입니다. 처음이시면 길찾기 안내를 먼저
            보시는 편이 빠릅니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/welcome"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-4 text-sm font-bold transition hover:bg-[var(--color-navy-100)]"
            >
              처음 오시는 분
            </Link>
            <Link
              href="/location"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-4 text-sm font-bold transition hover:bg-[var(--color-navy-100)]"
            >
              오시는 길
            </Link>
          </div>
        </div>
      </Section>
    </main>
  );
}
