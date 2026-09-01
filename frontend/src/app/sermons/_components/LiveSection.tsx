"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import type { LiveStream, Sermon } from "@/types/api";

/**
 * 라이브 상태를 다시 물어보는 주기.
 *
 * 주일 예배는 **일요일 13:45 무렵** 올라온다. 그 시각에 화면을 열어두고
 * 있던 사람이 새로고침을 해야만 라이브를 본다면, "라이브가 뜨면 바로 간다"는
 * 요구가 반쯤만 지켜지는 것이다. 60초면 방송 시작을 1분 안에 따라잡는다.
 *
 * ⚠️ 이 값이 백엔드 캐시 TTL보다 짧아야 의미가 있다 — `BACKEND_HANDOFF`에
 * "캐시를 걸더라도 60초를 넘기지 말 것"으로 적어뒀다.
 */
const LIVE_POLL_MS = 60_000;

/** 한 줄에 4편 (요청 사양) */
const LATEST_COUNT = 4;

/** `2026-08-30T05:00:00Z` → `2026. 8. 30.` */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/**
 * YouTube 썸네일. 영상이 비공개로 바뀌거나 지워지면 404가 오므로 깨진 이미지
 * 대신 자리표시자로 넘어간다. 16:9는 성공·실패와 무관하게 유지되어 레이아웃이
 * 튀지 않는다 (COMPONENTS.md §6.3).
 */
function Thumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        aria-hidden
        className="flex aspect-video items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]"
      >
        ▶ 영상 보기
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- YouTube CDN 이미지다. next/image에 넣으면 remotePatterns 설정이 필요하고 우리 서버가 남의 이미지를 재가공·캐시하게 된다 (COMPONENTS.md §6.1)
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="aspect-video w-full rounded-[var(--radius-card)] bg-[var(--color-navy-100)] object-cover"
    />
  );
}

/**
 * 방송 중일 때의 화면 — 재생 화면 + "라이브로 바로 가기".
 *
 * ## 왜 임베드 플레이어를 두는가
 *
 * 설교 목록(`FR-PUB-09`)은 자체 플레이어 없이 새 탭으로 보낸다. 라이브는
 * 다르게 판단했다: **예배 시간에 들어온 사람은 지금 그 자리에서 보려고
 * 온 것**이고, 새 탭으로 튕기면 예배 도중에 화면을 한 번 잃는다.
 *
 * 그래도 나가는 길은 남긴다 — 임베드가 막히는 환경(회사망·확장 프로그램)이
 * 있고, 채팅에 참여하려면 YouTube로 가야 한다. 그래서 **화면 + 바로 가기
 * 버튼**을 함께 둔다.
 *
 * `autoplay`는 넣지 않는다. 예배 시간이 아닌 사람이 목록을 훑다가 소리가
 * 터지는 것을 막는다 (NFR-A11Y — 사용자가 시작한 재생만).
 */
function LivePanel({ live }: { live: LiveStream }) {
  return (
    <Section className="pt-0">
      <div className="rounded-[var(--radius-card)] border border-[var(--color-red-500)] p-4 md:p-6">
        <p className="flex items-center gap-2 text-sm font-bold text-[var(--color-red-500)]">
          {/* 점은 장식이다 — 상태는 옆 글자가 말한다 */}
          <span aria-hidden>●</span> 지금 라이브 중
        </p>
        <h2 className="mt-2 text-xl font-bold md:text-2xl">{live.title}</h2>

        <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-navy-100)]">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${live.videoId}`}
            title={live.title}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            className="aspect-video w-full"
          />
        </div>

        <div className="mt-4 flex justify-center">
          <a
            href={live.watchUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-red-500)] px-6 text-base font-bold text-[var(--color-danger-fg)] transition hover:brightness-95"
          >
            ▶ 라이브로 바로 가기
          </a>
        </div>
      </div>
    </Section>
  );
}

/** 방송 중이 아닐 때 — 최신 4편을 한 줄로 */
function LatestRow({ sermons }: { sermons: Sermon[] }) {
  return (
    <Section className="pt-0">
      <h2 className="text-lg font-bold">최근 예배 영상</h2>
      <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {sermons.map((sermon) => (
          <li key={sermon.id}>
            <a
              href={sermon.youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-[var(--radius-card)] transition hover:opacity-90"
            >
              <Thumbnail src={sermon.thumbnailUrl} />
              <p className="mt-3 font-bold">{sermon.title}</p>
              <p className="mt-1 text-sm text-[var(--color-gray-400)]">
                {formatDate(sermon.publishedAt)}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * 로딩 자리표시자.
 *
 * 라이브 여부에 따라 높이가 크게 달라지는데(플레이어 vs 카드 한 줄), 둘 중
 * 하나를 미리 그리면 반대 결과가 왔을 때 레이아웃이 크게 밀린다. 그래서
 * **더 자주 나오는 쪽(카드 한 줄)**을 예약한다 — 라이브는 주 1회 두 시간
 * 남짓이고 나머지 시간은 전부 카드다.
 */
function LiveSectionSkeleton() {
  return (
    <Section className="pt-0" aria-hidden>
      <div className="h-7 w-32 rounded bg-[var(--color-navy-100)]/60" />
      <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: LATEST_COUNT }, (_, i) => (
          <li key={i}>
            <div className="aspect-video rounded-[var(--radius-card)] bg-[var(--color-navy-100)]/50" />
            <div className="mt-3 h-6 w-5/6 rounded bg-[var(--color-navy-100)]/60" />
            <div className="mt-1 h-5 w-1/3 rounded bg-[var(--color-navy-100)]/40" />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * WIREFRAME.md §5 `/sermons` 상단 — 라이브 또는 최신 4편.
 *
 * **라이브가 있으면 라이브만, 없으면 최신 4편만** 보여준다. 둘을 같이 그리지
 * 않는 이유: 예배 시간에 들어온 사람에게 지난 영상은 방해다. 지난 영상 전체는
 * 아래 "유튜브로 바로가기"가 담당한다.
 *
 * ⚠️ **서버에서 prefetch하지 않는다.** `/news`가 같은 판단이다 —
 * 백엔드가 없는 환경에서 정적 생성이 응답을 기다리다 빌드가 죽는다.
 * 라이브는 더 강한 이유가 있다: 빌드 시점의 방송 여부를 구워두면 정확히
 * 틀린 값이 캐시된다.
 */
export function LiveSection() {
  const liveQuery = useQuery({
    queryKey: ["sermons", "live"],
    queryFn: () => api.sermons.live(),
    refetchInterval: LIVE_POLL_MS,
    // 탭을 다시 열었을 때 옛 상태를 잠깐이라도 보여주지 않는다
    refetchOnWindowFocus: true,
  });

  const latestQuery = useQuery({
    queryKey: ["sermons", "latest", LATEST_COUNT],
    queryFn: () => api.sermons.list({ page: 0, size: LATEST_COUNT }),
    // 라이브 중이면 쓰지 않지만, 방송이 끝나는 순간 바로 그릴 수 있게 받아둔다
    staleTime: 5 * 60_000,
  });

  if (liveQuery.isLoading) return <LiveSectionSkeleton />;

  if (liveQuery.data) return <LivePanel live={liveQuery.data} />;

  // 라이브 조회가 실패해도 화면을 비우지 않는다 — 최신 영상은 보여줄 수 있다.
  // 실패를 빨간 문구로 알리면 "방송이 없다"와 구별되지 않아 더 혼란스럽다.
  if (latestQuery.isLoading) return <LiveSectionSkeleton />;

  const sermons = latestQuery.data?.items ?? [];
  if (sermons.length === 0) {
    return (
      <Section className="pt-0">
        <p className="text-[var(--color-gray-400)]">아직 등록된 영상이 없습니다.</p>
      </Section>
    );
  }

  return <LatestRow sermons={sermons} />;
}
