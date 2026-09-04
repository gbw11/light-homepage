import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { Accordion } from "@/components/ui/Accordion";
import { BuildingSketch } from "@/components/ui/BuildingSketch";
import { RouteMap } from "@/components/ui/RouteMap";
import { KAKAO_MAP_URL } from "@/content/location";

export const metadata: Metadata = {
  title: "처음 오시는 분",
  description:
    "청년예배는 본당이 아니라 드림센터 4층입니다. 혼자 오셔도 괜찮습니다.",
};

const TIMELINE = [
  { time: "~13:50", label: "도착", detail: "입구에서 안내받기" },
  { time: "14:00", label: "청년예배", detail: "드림센터 4층" },
  { time: "~15:20", label: "예배 종료 · 교제", detail: null },
  { time: "15:30", label: "마을모임 (30분)", detail: "처음이면 새가족마을" },
  { time: "16:00", label: "마치고 자유롭게", detail: null },
];

const FAQ_ITEMS = [
  { question: "몇 살까지 청년교회인가요?", answer: "20세~39세 또는 결혼 전까지입니다." },
  { question: "뭘 입고 가야 하나요?", answer: "편한 차림으로 오시면 됩니다." },
  { question: "혼자 가도 괜찮을까요?", answer: "네, 혼자 오셔도 전혀 괜찮습니다." },
  { question: "헌금을 해야 하나요?", answer: "필수가 아닙니다. 부담 없이 오세요." },
  {
    question: "마을에 꼭 들어가야 하나요?",
    answer: "예배만 참석하고 가셔도 괜찮습니다.",
  },
];

/**
 * WIREFRAME.md §2 — ★최우선 페이지.
 * ❓ 표시는 아직 확정되지 않은 정보(사진 3장, 도보 시간, 새가족마을 운영 방식,
 * 주차/대중교통, 카카오톡 문의)다. 확정되기 전까지 이 페이지는 완성이 아니다.
 */
export default function WelcomePage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <p className="text-sm font-bold text-[var(--color-gray-400)]">
          처음 오시는 분께
        </p>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">
          혼자 오셔도 괜찮습니다.
        </h1>
      </Section>

      <Section title="① 드림센터를 찾아오세요" className="pt-0">
        {/*
          경고 신호는 테두리가 지고, 글자는 기본 색으로 둔다.
          `--color-red-500`을 글자로 쓰면 이 틴트(#e1cec7) 위에서 4.01:1로
          WCAG AA(4.5:1)에 미달한다 — 토큰은 페이지 배경(#e5e0d8) 위 4.63:1
          기준으로 검증됐는데, 이 블록만 `/10` 틴트로 다른 표면을 만들어
          그만큼 깎아먹었다. 기본 글자색이면 9.53:1이다.
          `PostForm`·`MeetingUploadForm`의 경고 블록이 이미 이 형태다.
        */}
        <div className="rounded-[var(--radius-card)] border border-[var(--color-red-500)] bg-[var(--color-red-500)]/10 p-4 font-bold">
          ⚠️ 청년예배는 본당이 아니라 <strong>드림센터 4층</strong>입니다.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {/*
            앞 두 칸은 지도·로드뷰를 보고 직접 그린 그림이다 — 둘 다 화면
            자체를 가져다 올릴 수 없어서(라이선스 · 로드뷰에 찍힌 차량 번호판)
            그렸다.

            **입구 사진 한 칸은 여전히 회색 상자다.** 건물 속은 밖에서 보이지
            않아 그려 맞힐 수가 없고, 인터넷 사진으로 대체하지 않기로 했다
            (DECISIONS 2026-08-21). 교회에서 찍어오면 넣는다.
          */}
          <figure className="flex aspect-square items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] p-2">
            <RouteMap className="h-full w-full" />
          </figure>
          <figure className="flex aspect-square items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] p-2">
            <BuildingSketch className="h-full w-full" />
          </figure>
          <figure className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]">
            <span>입구 사진</span>
            <span>&quot;여기로 들어와 4층으로&quot;</span>
          </figure>
        </div>

        {/*
          "도보 ❓"였다. 2026-09-04 카카오맵 도보 길찾기 실측 — 큰길우선·최단거리·
          편안한길 세 경로가 모두 134m / 2분으로 같다. 갈림길이 사실상 없다는 뜻이라
          약도가 한 번의 우회전으로 끝난다.
        */}
        <p className="mt-6 text-base text-[var(--color-gray-400)]">
          본당 앞에서 <strong className="text-[var(--color-ink)]">도보 2분</strong> (134m)
          — 남쪽으로 내려가 초등학교 끝에서 오른쪽입니다.
        </p>
        {/*
          예전에는 "링크 확인 필요"로 영구 비활성이었지만, `/location`이 이미
          같은 주소로 동작하는 카카오맵 링크를 갖고 있었다. 값을
          `content/location.ts`로 모으면서 여기서도 쓴다 — 길찾기가 이 페이지의
          존재 이유인데(★최우선) 버튼이 죽어 있을 이유가 없다.
        */}
        <a
          href={KAKAO_MAP_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
        >
          지도 앱으로 열기
        </a>
      </Section>

      <Section title="② 주일은 이렇게 흘러갑니다">
        <ol className="space-y-4 border-l-2 border-[var(--color-navy-100)] pl-4">
          {TIMELINE.map((item) => (
            <li key={item.label}>
              <p className="font-bold">
                {item.time} · {item.label}
              </p>
              {item.detail && (
                <p className="text-sm text-[var(--color-gray-400)]">{item.detail}</p>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-6 text-base">예배만 참석하고 가셔도 괜찮아요.</p>
      </Section>

      <Section title="③ 새가족마을">
        <p>처음 오신 분들이 함께 모이는 마을이 따로 있습니다.</p>
        <p className="mt-2 text-sm text-[var(--color-gray-400)]">
          ❓ 운영 기간 · 배정 방식 확인 필요
        </p>
      </Section>

      <Section title="주차 · 대중교통">
        {/*
          주차 전문은 `/location`에 있다. 여기서 되풀이하면 교회 규칙이 바뀔 때
          고칠 곳이 둘이 되고, 이 화면은 "처음 오는 사람이 겁먹지 않게"가
          목적이라 규칙을 길게 늘어놓을 자리가 아니다. 대신 **주일에만 열리는
          곳이 둘**이라는 사실만 미리 흘린다 — 그게 헛걸음을 막는다.
        */}
        <p className="text-sm">
          김해교회 주차장 세 곳을 함께 씁니다. 세 곳 중 <strong>두 곳은 주일에만</strong>{" "}
          주차할 수 있습니다.
        </p>
        <Link
          href="/location#parking"
          className="mt-3 inline-flex min-h-11 items-center font-bold underline"
        >
          ▸ 주차장 위치와 약도 보기
        </Link>
        <p className="mt-4 text-sm text-[var(--color-gray-400)]">
          ❓ 버스 안내는 아직 확인 중입니다.
        </p>
      </Section>

      <Section title="자주 묻는 질문">
        <Accordion items={FAQ_ITEMS} />
      </Section>

      <Section title="미리 알려주시면 맞이하겠습니다">
        <Link
          href="/welcome/register"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
        >
          새가족 등록하기
        </Link>
        <p className="mt-4 text-sm text-[var(--color-gray-400)]">
          ▸ 카카오톡으로 문의 (❓ 확인 필요)
        </p>
      </Section>
    </main>
  );
}
