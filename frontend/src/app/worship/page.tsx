import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import {
  VILLAGE_LINE,
  YOUTH_GATHERINGS,
  YOUTH_SERVICE_LINE,
} from "@/content/worship";

export const metadata: Metadata = {
  title: "예배와 모임",
  description:
    `청년예배(${YOUTH_SERVICE_LINE}), 마을모임(${VILLAGE_LINE}), 기도회 안내.`,
};

/*
  시간표 데이터는 `content/worship.ts`에 있다.

  전에는 이 자리에 `SCHEDULE` 상수가 있고 주석이 "값이 바뀌면 한 곳만 고치면
  되도록 출처를 하나로 만든다"고 적혀 있었다. **그게 사실이 아니었다** — 같은
  문자열이 홈·푸터·헤더·문의·등록 폼과 metadata 6곳에 각자 박혀 있었다.
  이제는 정말로 한 곳이다.
*/

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

      {/*
        예배 안내 표 — 모교회(`gloria.or.kr`)의 "예배 안내"와 같은 뼈대다
        (PM 요청 2026-09-01). 이름 칸이 배경으로 구분되고, 시각과 장소가
        오른쪽에 붙는다. 모교회 표에 우리가 **`청년교회 · 주일 14:00 ·
        드림센터4층`** 한 줄로 들어가 있는데, 이 화면은 그 한 줄을 펼친 것이다.

        `<table>`을 쓴다 — 행마다 "이름 / 시각 / 장소"가 대응하는 표 데이터다.
        div로 그리면 스크린리더가 열 관계를 읽어주지 못한다.
      */}
      <Section title="예배와 모임 시간" className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">청년교회 예배와 모임 시간·장소</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">구분</th>
                <th scope="col">시각</th>
                <th scope="col">장소</th>
              </tr>
            </thead>
            <tbody>
              {YOUTH_GATHERINGS.map((row) => (
                <tr key={row.name} className="border-b border-[var(--color-navy-100)]">
                  <th
                    scope="row"
                    className="w-32 bg-[var(--color-navy-100)] px-4 py-3 font-bold md:w-44"
                  >
                    {row.name}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums md:text-left">{row.time}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-gray-400)]">
                    {row.place}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Link
          href="/location"
          className="mt-6 inline-flex min-h-11 items-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)]"
        >
          오시는 길
        </Link>
      </Section>

      <Section title="마을모임">
        <p className="text-base text-[var(--color-gray-400)]">
          1마을부터 9마을로 나뉘어 모입니다. 처음 오신 분은 새가족마을에서
          함께 시작합니다.
        </p>
        <Link
          href="/welcome"
          className="mt-4 inline-flex min-h-11 items-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold text-[var(--color-ink)]"
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
