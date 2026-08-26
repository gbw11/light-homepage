import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { Accordion } from "@/components/ui/Accordion";
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
        <div className="rounded-[var(--radius-card)] bg-[var(--color-red-500)]/10 p-4 text-[var(--color-red-500)]">
          ⚠️ 청년예배는 본당이 아니라 <strong>드림센터 4층</strong>입니다.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <figure className="flex aspect-square items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]">
            본당 ↔ 드림센터 약도
          </figure>
          <figure className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]">
            <span>드림센터 외관 사진</span>
            <span>&quot;이 건물입니다&quot;</span>
          </figure>
          <figure className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]">
            <span>입구 사진</span>
            <span>&quot;여기로 들어와 4층으로&quot;</span>
          </figure>
        </div>

        <p className="mt-6 text-base text-[var(--color-gray-400)]">
          본당 앞에서 도보 ❓ (확인 필요)
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
        <p className="text-sm text-[var(--color-gray-400)]">
          ❓ 주차장 위치, 버스/도보 안내 확인 필요
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
