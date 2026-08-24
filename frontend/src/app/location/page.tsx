import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "오시는 길 | LIGHT",
  description:
    "경남 김해시 분성로317번길 31, 드림센터 4층. 카카오맵·네이버지도로 길찾기.",
};

const ADDRESS = "경남 김해시 분성로317번길 31";
const KAKAO_MAP_URL = `https://map.kakao.com/link/search/${encodeURIComponent(ADDRESS)}`;
const NAVER_MAP_URL = `https://map.naver.com/p/search/${encodeURIComponent(ADDRESS)}`;

const linkButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold text-[var(--color-navy-900)] transition hover:brightness-95";

/**
 * WIREFRAME.md §8 — 오시는 길.
 * ❓ 표시는 아직 확정되지 않은 정보(드림센터 외관 사진, 주차/대중교통 안내)다.
 * 지도는 이미지 + 외부 앱 링크 방식만 사용한다 (JS 지도 SDK는 Phase 3 재검토).
 */
export default function LocationPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <h1 className="text-2xl font-bold md:text-3xl">오시는 길</h1>
      </Section>

      <Section className="pt-0">
        <figure className="flex aspect-video flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] bg-[var(--color-navy-100)] p-4 text-center text-sm text-[var(--color-gray-400)]">
          <span>지도 미리보기는 준비 중입니다.</span>
          <span>아래 버튼으로 카카오맵·네이버지도에서 바로 확인하세요.</span>
        </figure>

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

        <div className="mt-4 rounded-[var(--radius-card)] bg-[var(--color-red-500)]/10 p-4 text-[var(--color-red-500)]">
          ⚠️ 청년예배는 <strong>드림센터 4층</strong>입니다.
        </div>

        <figure className="mt-6 flex aspect-video items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-gray-400)]">
          드림센터 외관 사진 (❓ 확인 필요)
        </figure>
      </Section>

      <Section title="주차 안내" className="pt-0">
        <p className="text-sm text-[var(--color-gray-400)]">❓ 확인 필요</p>
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
