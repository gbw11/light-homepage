import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { AboutHero } from "./_components/AboutHero";

export const metadata: Metadata = {
  title: "소개",
  description:
    "LIGHT — Live In God, Help The other. 하나님 안에 사는 것과 이웃을 돕는 것, 두 축으로 세워지는 청년교회를 소개합니다.",
};

/**
 * 출처: 실제 LIGHT 주보 2026-08-23 (YEAR 2026 · ISSUE 34) "청년교회를 섬기는 이들".
 *
 * **주보에 있는 이름을 다 옮기지 않았다.** 칸이 넷인데 주보에는 교역자 3명 ·
 * 장로 1명 · 멘토집사 4명 · 임원 6명이 실려 있다. 넣은 기준은 이렇다.
 *
 * - **청년전도사 유운형** — 모교회가 `gloria.or.kr/blank-9`에 **사진까지 공개**
 *   하고 있다. 우리 화면에 적는 것이 새로운 노출이 아니다
 * - **회장·부회장·총무** — 청년부에 처음 오는 사람이 실제로 마주치는 사람들이다
 * - 회계·부회계·서기·장로·멘토집사는 넣지 않았다. 칸이 없고, 앞의 세 명과 달리
 *   방문자가 먼저 만날 일이 적다
 *
 * ⚠️ **임원 세 명의 이름은 모교회 공개 목록에 없다** — 청년부 내부 정보다.
 *    주보는 회원에게 배포되는 문서이고 이 화면은 공개다. 본인 동의 확인은
 *    PM 몫으로 남겨 뒀다 (PM 판단 2026-09-04, `DECISIONS.md`).
 *    빼야 한다면 이 배열에서 지우면 된다 — 다른 곳에 흩어져 있지 않다.
 *
 * 얼굴 사진은 여전히 없다. 아래 `<figure>`는 회색 상자로 남는다.
 */
const SERVING_LEADERS = [
  { role: "청년전도사", detail: "유운형" },
  { role: "회장", detail: "이재현" },
  { role: "부회장", detail: "이소연" },
  { role: "총무", detail: "박진민" },
];

const YEAR_FLOW = [
  { season: "봄", detail: "❓ 확인 필요" },
  { season: "여름", detail: "수련회 · ❓ 상세 확인 필요" },
  { season: "가을", detail: "❓ 확인 필요" },
  { season: "겨울", detail: "❓ 확인 필요" },
];

/**
 * WIREFRAME.md §3 — LIGHT 아크로스틱을 그대로 페이지 구조로 사용 (PLAN §1.5).
 * ❓ 표시는 아직 확정되지 않은 정보다 — **한 해의 흐름**과 **사진 3장**.
 * 담당 교역자·임원 명단은 2026-09-04에 실제 주보에서 확보했다(위 배열 주석).
 * 확정되기 전까지 이 페이지는 완성이 아니다.
 */
export default function AboutPage() {
  return (
    <main id="main" tabIndex={-1}>
      {/*
        원래 `/`에 있던 전체화면 사진 게이트를 정적 히어로로 옮겨왔다
        (`AboutHero`, PM 요청 2026-09-10) — 대신 애니메이션되는 글자
        (`LightIntro`였던 것)는 `/`으로 옮겨서 첫 화면의 인트로가 됐다.

        h1은 시각적으로 숨기지 않고 스크린리더 전용으로만 둔다 — 페이지 제목은
        여전히 필요하지만(SPEC_NONFUNCTIONAL.md §6), 화면에는 히어로 안의
        워드마크만 보이게 한다.
      */}
      <AboutHero />
      <h1 className="sr-only">LIGHT — Live In God, Help The other</h1>

      <Section className="pt-0 pb-8 text-center md:pb-8">
        {/*
          주보 로고가 `LIGHT`와 함께 쓰는 성구다. `LightIntro`를 대체하지 않는다 —
          **둘은 경쟁이 아니다.** 마 5:16은 성구고, `Live In God, Help The other`는
          LIGHT라는 이름의 뜻이다 (`PLAN §1.5`). 주보 로고도 둘을 같이 쓴다.
          (PM 판단 2026-09-04 "표어는 둘 다 산다" — 인트로를 정리해도 이 문구는
          지우지 않는다.)
        */}
        <p className="text-base text-[var(--color-gray-400)]">
          <strong className="text-[var(--color-ink)]">
            &ldquo;너의 빛으로 세상을 비추라&rdquo;
          </strong>{" "}
          — 마태복음 5장 16절
        </p>
      </Section>

      <Section title="Live In God">
        <p className="text-base">
          하나님 안에 사는 것 — 예배와 말씀으로 세워집니다.
        </p>
        <figure className="mt-6 flex aspect-video items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]">
          예배 사진
        </figure>
      </Section>

      <Section title="Help The other" className="pt-0">
        <p className="text-base">
          이웃을 돕는 것 — 마을과 섬김으로 함께합니다.
        </p>
        <figure className="mt-6 flex aspect-video items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]">
          공동체 사진
        </figure>
      </Section>

      <Section title="섬기는 사람들">
        <div className="grid gap-4 md:grid-cols-4">
          {SERVING_LEADERS.map((person) => (
            <div key={person.role} className="flex flex-col gap-2">
              <figure className="flex aspect-square items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]">
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
