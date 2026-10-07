"use client";

import { useCallback, useState } from "react";
import { Section } from "@/components/ui/Section";

/**
 * 오늘(2026-09-15) 22:32~22:33 캡처 순서 그대로 4장 + 도착지 사진 1장.
 * PM 요청대로 "시간순 나열"이라 편집(순서 변경·중간 프레임 제외) 없이 그대로
 * 옮겼다 — 02번 프레임(전환 중, 하늘만 보임)도 뺴지 않는다.
 *
 * 앞 4장은 `/mock-assets/*`(개발 전용, 배포에서 404)에서 나가고, 마지막
 * 도착 사진만 PM이 전달한 URL을 그대로 받아 배치했다(`/mock-assets`에 함께
 * 둔 이유는 자산을 한 폴더로 관리하기 위함이지, 배포 노출 여부를 이 사진에
 * 대해서까지 판단한 것은 아니다 — 실사진이지만 교회가 직접 찍은 것이 아니라
 * 제3자 게시물이라 마찬가지로 임시다).
 */
const FRAMES = [
  {
    src: "/mock-assets/_selected/route-to-dreamcenter/01-church-entrance.png",
    time: "22:32:54",
    caption: "본당 정문 — 여기서 출발합니다",
  },
  {
    src: "/mock-assets/_selected/route-to-dreamcenter/02-transition.png",
    time: "22:33:01",
    caption: "이동 중",
  },
  {
    src: "/mock-assets/_selected/route-to-dreamcenter/03-church-street.png",
    time: "22:33:05",
    caption: "본당 앞 도로",
  },
  {
    src: "/mock-assets/_selected/route-to-dreamcenter/04-alley-crossing.png",
    time: "22:33:16",
    caption: "골목 교차로",
  },
  {
    src: "/mock-assets/_selected/route-to-dreamcenter/dreamcenter-naver.jpg",
    time: null,
    caption: "도착 — 드림센터",
  },
] as const;

export function RouteSlideshow() {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const frame = FRAMES[index];

  const goTo = useCallback((next: number) => {
    if (next < 0) return setIndex(FRAMES.length - 1);
    if (next >= FRAMES.length) return setIndex(0);
    setIndex(next);
  }, []);

  const markFailed = useCallback((i: number) => {
    setFailed((prev) => new Set(prev).add(i));
  }, []);

  return (
    <Section className="pt-8 md:pt-12">
      <h1 className="text-2xl font-bold md:text-3xl">오는 길 미리보기</h1>
      <p className="mt-2 text-sm text-[var(--color-gray-400)]">
        본당에서 드림센터까지, 오늘 캡처한 화면을 시간순으로 이어 붙였습니다.
      </p>

      {/*
        임시 자료 안내. 라이선스·개인정보 확정 전이라 배포에는 나가지 않는다
        (DECISIONS.md 2026-09-15) — 그 사실을 화면에도 적어, 나중에 이 페이지를
        여는 사람이 "왜 이미지가 안 보이지"를 여기서 바로 알 수 있게 한다.
      */}
      <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-gray-400)]/40 bg-[var(--color-navy-100)] p-4 text-sm text-[var(--color-gray-400)]">
        ⚠️ 로드뷰 캡처 임시 사용 중 (2026-09-15 결정, 배포 전 실사진으로 교체
        예정). 앞 4장은 개발 환경에서만 보입니다.
      </div>

      <div className="mt-6 w-full max-w-2xl">
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-navy-100)]">
          {failed.has(index) ? (
            <p className="px-6 text-center text-sm text-[var(--color-gray-400)]">
              이 이미지는 개발 환경에서만 보입니다.
              <br />
              (`{frame.src}`)
            </p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- 개발 전용 mock-assets 경로라 next/image 최적화 대상이 아니다 (COMPONENTS.md §6.1과 동일 근거)
            <img
              src={frame.src}
              alt={frame.caption}
              className="h-full w-full object-cover"
              onError={() => markFailed(index)}
            />
          )}

          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="이전 장면"
            className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-ink)]/60 text-[var(--color-accent-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="다음 장면"
            className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-ink)]/60 text-[var(--color-accent-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]"
          >
            ›
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p>
            <span className="font-bold">{frame.caption}</span>
            {frame.time && (
              <span className="ml-2 text-sm text-[var(--color-gray-400)]">{frame.time}</span>
            )}
          </p>
          <p className="text-sm text-[var(--color-gray-400)]">
            {index + 1} / {FRAMES.length}
          </p>
        </div>

        <div className="mt-3 flex gap-2">
          {FRAMES.map((f, i) => (
            <button
              key={f.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}번째 장면(${f.caption})으로 이동`}
              aria-current={i === index}
              className={`h-2 flex-1 rounded-full transition ${
                i === index ? "bg-[var(--color-yellow)]" : "bg-[var(--color-gray-400)]/30"
              }`}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
