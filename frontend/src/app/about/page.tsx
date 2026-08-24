import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "소개 | LIGHT",
  description:
    "LIGHT — Live In God, Help The other. 하나님 안에 사는 것과 이웃을 돕는 것, 두 축으로 세워지는 청년교회를 소개합니다.",
};

const ACROSTIC = ["L", "I", "G", "H", "T"];

const SERVING_LEADERS = [
  { role: "담당 교역자", detail: "❓ 이름 · 직함 확인 필요" },
  { role: "임원 1", detail: "❓ 확인 필요" },
  { role: "임원 2", detail: "❓ 확인 필요" },
  { role: "임원 3", detail: "❓ 확인 필요" },
];

const YEAR_FLOW = [
  { season: "봄", detail: "❓ 확인 필요" },
  { season: "여름", detail: "수련회 · ❓ 상세 확인 필요" },
  { season: "가을", detail: "❓ 확인 필요" },
  { season: "겨울", detail: "❓ 확인 필요" },
];

/**
 * WIREFRAME.md §3 — LIGHT 아크로스틱을 그대로 페이지 구조로 사용 (PLAN §1.5).
 * ❓ 표시는 아직 확정되지 않은 정보(담당 교역자·임원진 정보, 한 해의 흐름 상세)다.
 * 확정되기 전까지 이 페이지는 완성이 아니다.
 */
export default function AboutPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <p className="text-sm font-bold text-[var(--color-gray-400)]">LIGHT</p>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">
          Live In God, Help The other
        </h1>
      </Section>

      <Section title="LIGHT" className="pt-0">
        <div className="flex flex-col items-center gap-2 md:gap-4">
          {ACROSTIC.map((letter) => (
            <span
              key={letter}
              className="text-6xl font-bold text-[var(--color-yellow)] md:text-8xl"
            >
              {letter}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Live In God">
        <p className="text-base">
          하나님 안에 사는 것 — 예배와 말씀으로 세워집니다.
        </p>
        <figure className="mt-6 flex aspect-video items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-navy-900)]">
          예배 사진
        </figure>
      </Section>

      <Section title="Help The other" className="pt-0">
        <p className="text-base">
          이웃을 돕는 것 — 마을과 섬김으로 함께합니다.
        </p>
        <figure className="mt-6 flex aspect-video items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-navy-900)]">
          공동체 사진
        </figure>
      </Section>

      <Section title="섬기는 사람들">
        <div className="grid gap-4 md:grid-cols-4">
          {SERVING_LEADERS.map((person) => (
            <div key={person.role} className="flex flex-col gap-2">
              <figure className="flex aspect-square items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-navy-900)]">
                ❓
              </figure>
              <p className="font-bold">{person.role}</p>
              <p className="text-sm text-[var(--color-gray-400)]">
                {person.detail}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="한 해의 흐름 (❓ 확인 필요)">
        <ol className="grid gap-6 md:grid-cols-4">
          {YEAR_FLOW.map((item) => (
            <li
              key={item.season}
              className="border-l-2 border-[var(--color-navy-100)] pl-4"
            >
              <p className="font-bold">{item.season}</p>
              <p className="text-sm text-[var(--color-gray-400)]">
                {item.detail}
              </p>
            </li>
          ))}
        </ol>
      </Section>
    </main>
  );
}
