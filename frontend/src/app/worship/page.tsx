import type { Metadata } from "next";
import Link from "next/link";
import { Accordion } from "@/components/ui/Accordion";
import { Section } from "@/components/ui/Section";
import { MAIN_CHURCH_ADDRESS } from "@/content/location";
import {
  MAIN_CHURCH_SERVICES,
  PRAYER_MEETINGS,
  VILLAGE_LINE,
  YOUTH_SERVICE_LINE,
  type ServiceRow,
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
 *
 * **위계를 표로 표현하지 않는다.** 2026-09-04에 본당 1·2·3부가 들어왔는데
 * (실제 주보 2026-08-23 ISSUE 34), 이걸 청년예배와 같은 표에 넣으면 다섯 행이
 * 나란히 놓여 **청년예배가 1·2·3부와 동급이 된다.** 이 사이트는 청년교회
 * 사이트고 `WIREFRAME §4`가 청년예배를 주인공으로 잡아뒀다. 그래서 네 섹션의
 * **불균등한 무게**로 위계를 만든다 — 청년예배는 단독 카드, 본당은 맨 아래
 * 접힌 표.
 *
 * 마을별 개별 페이지는 만들지 않는다 (PLAN §4.4 결정) — 이 섹션 텍스트가
 * 마을 정보의 전부다.
 */
export default function WorshipPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <h1 className="text-2xl font-bold md:text-3xl">예배와 모임</h1>
      </Section>

      {/*
        청년예배는 표가 아니다. 행이 하나뿐인데 표로 그리면 아래 본당 표와
        같은 위계로 읽힌다. 이 화면에서 가장 큰 글자를 여기 쓴다.
      */}
      <Section title="청년예배" className="pt-0">
        <p className="text-xl font-bold md:text-2xl">{YOUTH_SERVICE_LINE}</p>
        <p className="mt-2 text-base text-[var(--color-gray-400)]">
          20세~39세 또는 결혼 전 청년이면 누구나 오실 수 있습니다.
        </p>
        <Link
          href="/location"
          className="mt-6 inline-flex min-h-11 items-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
        >
          오시는 길
        </Link>
      </Section>

      <Section title="마을모임" className="pt-0">
        <p className="text-base font-bold">{VILLAGE_LINE} (30분)</p>
        <p className="mt-2 text-base text-[var(--color-gray-400)]">
          1마을부터 9마을로 나뉘어 모입니다. 처음 오신 분은 새가족마을에서
          함께 시작합니다.
        </p>
        <Link
          href="/welcome"
          className="mt-4 inline-flex min-h-11 items-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold text-[var(--color-ink)] transition hover:brightness-95"
        >
          처음 오시는 분
        </Link>
      </Section>

      {/*
        여기가 `❓ 기도회 · 훈련과정 등 — 확인 필요`였던 자리다.
        주보 2026-08-23에서 금요기도회를 확보했다. 훈련과정은 아직 모른다.
      */}
      <Section title="기도회" className="pt-0">
        {PRAYER_MEETINGS.map((row) => (
          <div key={row.name}>
            <p className="text-base font-bold">
              {row.time} · {row.place}
            </p>
            {/* null이면 줄 자체를 그리지 않는다 (`worship.ts`의 null 규약) */}
            {row.exception && (
              <p className="mt-2 text-sm text-[var(--color-gray-400)]">
                ⓘ {row.exception}
              </p>
            )}
          </div>
        ))}
        <p className="mt-4 text-sm text-[var(--color-gray-400)]">
          ❓ 훈련과정은 아직 확인 중입니다.
        </p>
      </Section>

      {/*
        본당 예배는 맨 아래에 접어 둔다. 이 사이트에서 본당 시간표를 찾는
        상황은 "부모님이나 본당 성도와 함께 오는데" 같은 부차적 경우다.

        ⚠️ **장소 경고는 선택이 아니다.** 이 사이트 최대 사고 지점이
           "본당 vs 드림센터 혼동"이고(`location.ts` · `welcome/page.tsx` ·
           DECISIONS 2026-08-21), **본당 시간표를 추가하는 것 자체가 그 사고
           확률을 올리는 변경**이다. 같은 화면에 경고가 없으면 순손실이다.
      */}
      <Section title="본당 주일예배" className="pt-0">
        <Accordion
          items={[
            {
              question: "김해교회 본당 예배 시간 보기",
              answer: <MainChurchServices />,
            },
          ]}
        />
      </Section>
    </main>
  );
}

function MainChurchServices() {
  return (
    <div>
      <p className="rounded-[var(--radius-card)] border border-[var(--color-red-500)] bg-[var(--color-red-500)]/10 p-4 text-sm font-bold">
        ⚠️ 본당은 드림센터와 <strong>다른 건물</strong>입니다. 청년예배는 드림센터
        4층이고, 아래는 모교회 본당({MAIN_CHURCH_ADDRESS}) 예배입니다.
      </p>

      {/*
        `<table>`을 쓴다 — 행마다 "이름 / 시각 / 장소"가 대응하는 표 데이터다.
        div로 그리면 스크린리더가 열 관계를 읽어주지 못한다.
        (전에는 청년예배도 이 표에 있었는데, 그래서 표에서 빼냈다.)
      */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">김해교회 본당 주일예배 시간·장소</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">구분</th>
              <th scope="col">시각</th>
              <th scope="col">장소</th>
            </tr>
          </thead>
          <tbody>
            {MAIN_CHURCH_SERVICES.map((row: ServiceRow) => (
              <tr key={row.name} className="border-b border-[var(--color-navy-100)]">
                <th
                  scope="row"
                  className="w-24 bg-[var(--color-navy-100)] px-4 py-3 font-bold md:w-32"
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
    </div>
  );
}
