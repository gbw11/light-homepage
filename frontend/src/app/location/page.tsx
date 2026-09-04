import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { ParkingMap, RouteMap } from "@/components/ui/RouteMap";
import { ADDRESS, KAKAO_MAP_URL, NAVER_MAP_URL } from "@/content/location";
import { PARKING_CAUTION, PARKING_LOTS, PARKING_SOURCE_URL } from "@/content/parking";

export const metadata: Metadata = {
  title: "오시는 길",
  description:
    "경남 김해시 분성로317번길 31, 드림센터 4층. 카카오맵·네이버지도로 길찾기.",
};


const linkButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold text-[var(--color-ink)] transition hover:brightness-95";

/**
 * WIREFRAME.md §8 — 오시는 길.
 * ❓ 표시는 아직 확정되지 않은 정보(드림센터 외관 사진, 주차/대중교통 안내)다.
 * 지도는 이미지 + 외부 앱 링크 방식만 사용한다 (JS 지도 SDK는 Phase 3 재검토).
 * 그 "이미지"가 2026-09-04에 `RouteMap`으로 들어왔다 — 왜 스크린샷이 아니라
 * 직접 그린 SVG인지는 그 파일 주석에 있다.
 */
export default function LocationPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <h1 className="text-2xl font-bold md:text-3xl">오시는 길</h1>
      </Section>

      <Section className="pt-0">
        {/*
          `aspect-video`가 아니라 정사각이다 — 본당에서 드림센터로 가는 길이
          남쪽으로 길고 서쪽으로 짧아서, 가로로 넓은 상자에 넣으면 그림이
          가운데만 쓰고 양옆이 빈다. `max-w-sm`은 데스크톱에서 약도가 필요
          이상으로 커지지 않게 잡아둔 것이다.
        */}
        <figure className="mx-auto flex aspect-square w-full max-w-sm items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] p-3">
          <RouteMap className="h-full w-full" />
        </figure>
        <p className="mt-3 text-center text-sm text-[var(--color-gray-400)]">
          실제 지도는 아래 버튼으로 카카오맵·네이버지도에서 확인하세요.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={KAKAO_MAP_URL}
            target="_blank"
            rel="noreferrer"
            className={linkButtonClass}
          >
            카카오맵으로 보기
          </a>
          <a
            href={NAVER_MAP_URL}
            target="_blank"
            rel="noreferrer"
            className={linkButtonClass}
          >
            네이버지도로 보기
          </a>
        </div>

        <p className="mt-6 text-base font-bold">{ADDRESS}</p>

        {/* 대비 근거는 `welcome/page.tsx`의 같은 블록 주석 참고 */}
        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-red-500)] bg-[var(--color-red-500)]/10 p-4 font-bold">
          ⚠️ 청년예배는 <strong>드림센터 4층</strong>입니다.
        </div>

        <figure className="mt-6 flex aspect-video items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]">
          드림센터 외관 사진 (❓ 확인 필요)
        </figure>
      </Section>

      <Section id="parking" title="주차 안내" className="pt-0">
        {/*
          드림센터 전용 주차장은 없다 — 모교회 주차장 세 곳을 같이 쓴다.
          그래서 규칙도 우리가 정한 게 아니라 교회 것이고, 바뀌면 우리가 먼저
          알기 어렵다. 목록 끝에 출처 링크를 두는 이유다.
        */}
        <p className="text-sm text-[var(--color-gray-400)]">
          드림센터 전용 주차장은 없고, 김해교회 주차장 세 곳을 함께 씁니다.
        </p>

        <figure className="mx-auto mt-4 flex aspect-square w-full max-w-sm items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] p-3">
          <ParkingMap className="h-full w-full" />
        </figure>

        <ul className="mt-6 space-y-4">
          {PARKING_LOTS.map((lot) => (
            <li
              key={lot.no}
              className="rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4"
            >
              <p className="font-bold">
                {lot.no}주차장 · {lot.name}
              </p>
              <p className="mt-1 text-sm">{lot.toVenue}</p>
              {/*
                "언제 댈 수 있나"를 가장 눈에 띄게 둔다. 세 곳 중 두 곳이
                주일에만 열려서, 평일에 왔다가 헛걸음하는 게 가장 흔한 사고다.
              */}
              <p className="mt-2 text-sm font-bold">{lot.when}</p>
              {lot.needs && (
                <p className="mt-1 text-sm text-[var(--color-gray-400)]">{lot.needs}</p>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-red-500)] bg-[var(--color-red-500)]/10 p-4 text-sm">
          {PARKING_CAUTION}
        </p>

        <p className="mt-4 text-sm text-[var(--color-gray-400)]">
          김해교회 공식 안내를 옮긴 것입니다. 찬양대별 지정 주차 등 전체 규칙은{" "}
          <a
            href={PARKING_SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="font-bold underline"
          >
            교회 주차안내
          </a>
          에서 확인하세요.
        </p>
      </Section>

      <Section title="대중교통 안내" className="pt-0">
        <p className="text-sm text-[var(--color-gray-400)]">❓ 확인 필요</p>
      </Section>

      <Section className="pt-0">
        <Link href="/welcome" className="inline-flex min-h-11 items-center font-bold underline">
          ▸ 처음 오시는 분 (상세 동선)
        </Link>
      </Section>
    </main>
  );
}
