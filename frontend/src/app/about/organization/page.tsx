import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "조직도",
  description: "LIGHT 청년교회 조직도 — 임원단, 마을, 팀 구성을 소개합니다.",
};

/**
 * PM 결정 2026-09-10 (`docs/records/DECISIONS.md`) — 마을 이름·임원단 명단은
 * **이미 확정됐지만** 다른 작업을 다 마친 뒤 맨 마지막에 채워 넣기로 했다.
 * 그때까지 `❓`/"마을 1"~"마을 9" placeholder를 지우지 않는다.
 *
 * ⚠️ TODO(마지막 순서): 마을 이름·임원단 명단을 실제 값으로 채우기.
 * 팀 이름 6개는 확정이라 이미 반영돼 있다.
 */
const VILLAGE_COUNT = 9;

const TEAMS = [
  "찬양팀",
  "중보기도팀",
  "양육팀",
  "심방팀",
  "미디어팀",
  "선교팀",
] as const;

const TEAM_ROLES = ["팀장", "총무", "회계", "팀원"] as const;

/** WIREFRAME.md에 아직 없음 — 이 페이지 자체가 이번 기능(LIGHT-300)의 뼈대다 */
export default function OrganizationPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <h1 className="text-2xl font-bold md:text-3xl">조직도</h1>
        <p className="mt-2 text-sm text-[var(--color-gray-400)]">
          임원단, 마을, 팀으로 구성됩니다. 마을은 모든 회원이 필수로
          소속되고, 팀은 지원제로 운영됩니다.
        </p>
      </Section>

      <Section title="임원단">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <figure className="flex aspect-square items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]">
                ❓
              </figure>
              <p className="font-bold">임원 {i + 1}</p>
              <p className="text-sm text-[var(--color-gray-400)]">
                ❓ 확인 필요
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="마을 (9개)">
        <p className="mb-6 text-sm text-[var(--color-gray-400)]">
          모든 회원은 마을에 필수로 소속됩니다 (1인 1마을). 각 마을은 촌장
          1명과 마을원으로 구성됩니다.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: VILLAGE_COUNT }, (_, i) => (
            <div
              key={i}
              className="rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4"
            >
              <p className="font-bold">마을 {i + 1}</p>
              <p className="mt-1 text-sm text-[var(--color-gray-400)]">
                촌장: ❓ 확인 필요
              </p>
              <p className="mt-1 text-sm text-[var(--color-gray-400)]">
                마을원: ❓명
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="팀">
        <p className="mb-6 text-sm text-[var(--color-gray-400)]">
          팀은 지원자를 받아 운영하며, 마을 소속과 별개입니다. 각 팀은
          팀장·총무·회계·팀원으로 구성됩니다.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {TEAMS.map((team) => (
            <div
              key={team}
              className="rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4"
            >
              <p className="font-bold">{team}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {TEAM_ROLES.map((role) => (
                  <li
                    key={role}
                    className="text-sm text-[var(--color-gray-400)]"
                  >
                    {role}: ❓ 확인 필요
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
