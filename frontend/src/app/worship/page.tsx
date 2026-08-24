import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "예배와 모임 | LIGHT",
  description:
    "청년예배(주일 14:00 · 드림센터 4층), 마을모임(예배 후 15:30~16:00), 그 외 모임 안내.",
};

/**
 * WIREFRAME.md §4 — 예배와 모임 (FR-PUB-04).
 * 마을별 개별 페이지는 만들지 않는다 (PLAN §4.4 결정) — 이 섹션 텍스트가
 * 마을 정보의 전부다.
 * ❓ 표시는 기도회/훈련과정 등 아직 확정되지 않은 정보다.
 */
export default function WorshipPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <h1 className="text-2xl font-bold md:text-3xl">예배와 모임</h1>
      </Section>

      <Section title="청년예배" className="pt-0">
        <div className="rounded-[var(--radius-card)] bg-[var(--color-navy-100)] p-4">
          <p className="font-bold">주일 14:00 · 드림센터 4층</p>
        </div>
        <Link
          href="/location"
          className="mt-4 inline-flex min-h-11 items-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-navy-900)]"
        >
          오시는 길
        </Link>
      </Section>

      <Section title="마을모임">
        <div className="rounded-[var(--radius-card)] bg-[var(--color-navy-100)] p-4">
          <p className="font-bold">예배 후 15:30~16:00 (30분)</p>
        </div>
        <p className="mt-4 text-base text-[var(--color-gray-400)]">
          1마을부터 9마을로 나뉘어 모입니다. 처음 오신 분은 새가족마을에서
          함께 시작합니다.
        </p>
        <Link
          href="/welcome"
          className="mt-4 inline-flex min-h-11 items-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold text-[var(--color-navy-900)]"
        >
          처음 오시는 분
        </Link>
      </Section>

      <Section title="그 외 모임">
        <p className="text-sm text-[var(--color-gray-400)]">
          ❓ 기도회 · 훈련과정 등 — 확인 필요
        </p>
      </Section>
    </main>
  );
}
