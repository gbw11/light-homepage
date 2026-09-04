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
      {/*
        제목을 별도 `<Section>`으로 떼지 않는다. 떼면 두 섹션의 세로 여백을
        각각 물어서 약도가 첫 화면 밖으로 밀린다.

        ⚠️ `className="py-8"`으로 줄이려던 시도는 헛수였다 — `Section`이 이미
        `py-16 md:py-24`를 들고 있고 **같은 속성끼리는 클래스 순서가 아니라
        스타일시트 순서로 이기기 때문에** py-16이 그대로 남았다. `pt-*`처럼
        속성이 다른 유틸리티만 안전하게 덮어쓴다.
      */}
      <Section className="pt-8 md:pt-12">
        <h1 className="text-2xl font-bold md:text-3xl">오시는 길</h1>

        {/*
          경고를 약도보다 위에 둔다. 이 화면에서 가장 자주 놓치는 것이 "본당이
          아니다"이고, 그걸 모르면 약도를 봐도 엉뚱한 건물로 간다.
        */}
        <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--color-red-500)] bg-[var(--color-red-500)]/10 p-4 font-bold">
          ⚠️ 청년예배는 본당이 아니라 <strong>드림센터 4층</strong>입니다.
        </div>

        {/*
          약도 두 장을 **첫 화면에 나란히** 둔다. 걸어오는 사람과 차로 오는
          사람이 갈리는 지점이라, 하나를 스크롤 밑에 숨기면 그 절반이 못 본다.
          데스크톱 2열 / 모바일 1열 — 좁은 화면에서 옆으로 붙이면 정사각 약도가
          글자를 못 읽을 크기로 줄어든다.

          약도는 `aspect-video`가 아니라 정사각이다. 본당에서 드림센터로 가는
          길이 남북으로 길고 동서로 짧아서, 가로로 넓은 상자에 넣으면 그림이
          가운데만 쓰고 양옆이 빈다.
        */}
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          {/*
            `max-w-sm`은 재미가 아니다 — 정사각이라 상자 폭이 그대로 높이다.
            2열 전폭(544px)을 그대로 쓰면 약도 한 장이 544px를 잡아
            둘 다 첫 화면에 들어가지 않는다.
          */}
          <figure className="w-full max-w-sm">
            <div className="flex aspect-square items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] p-3">
              <RouteMap className="h-full w-full" />
            </div>
            <figcaption className="mt-3">
              <p className="font-bold">걸어서 — 본당에서 오는 길</p>
              <p className="mt-1 text-sm text-[var(--color-gray-400)]">
                본당 앞에서 남쪽으로 95m 내려가, 김해합성초등학교가 끝나는 곳에서
                오른쪽으로 39m.{" "}
                <strong className="text-[var(--color-ink)]">도보 2분</strong>입니다. 갈림길이
                없어 한 번만 꺾으면 됩니다.
              </p>
            </figcaption>
          </figure>

          <figure className="w-full max-w-sm">
            <div className="flex aspect-square items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] p-3">
              <ParkingMap className="h-full w-full" />
            </div>
            <figcaption className="mt-3">
              <p className="font-bold">차로 — 주차장에서 오는 길</p>
              <p className="mt-1 text-sm text-[var(--color-gray-400)]">
                드림센터 전용 주차장은 없고 김해교회 주차장 세 곳을 함께 씁니다.
                <strong className="text-[var(--color-ink)]"> 세 곳 중 두 곳은 주일에만</strong>{" "}
                주차할 수 있습니다. P3(합성초)가 가장 가깝습니다.
              </p>
              <a
                href="#parking"
                className="mt-2 inline-flex min-h-11 items-center text-sm font-bold underline"
              >
                ▸ 주차장별 이용 시간·준비물
              </a>
            </figcaption>
          </figure>
        </div>

        <p className="mt-8 text-sm text-[var(--color-gray-400)]">
          약도는 길을 알려주는 그림입니다. 실제 지도는 아래 버튼으로 확인하세요.
        </p>

        <div className="mt-3 flex flex-wrap gap-3">
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

        {/*
          주소는 약도·버튼 아래다. 여기까지 내려온 사람은 길을 이미 봤고,
          이 줄은 내비에 찍어 넣거나 남에게 보낼 때 쓴다.
          경고 블록의 대비 근거는 `welcome/page.tsx`의 같은 블록 주석 참고.
        */}
        <p className="mt-6 text-base font-bold">{ADDRESS}</p>

        <figure className="mt-6 flex aspect-video items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]">
          드림센터 외관 사진 (❓ 확인 필요)
        </figure>
      </Section>

      <Section id="parking" title="주차 안내" className="pt-0">
        {/*
          약도는 첫 화면으로 올라갔다. 여기 남은 것은 그림이 말할 수 없는
          것 — 언제 대는가와 뭐가 필요한가다.

          이 규칙은 우리가 정한 게 아니라 모교회 것이고, 바뀌어도 우리가
          먼저 알기 어렵다 — 목록 끝에 출처 링크를 고정으로 두는 이유다.
        */}
        <ul className="space-y-4">
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
