"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { StorageUsage } from "@/types/api";

/** 4.2GB 처럼 사람이 읽는 크기로. 10GB 단위 값이라 GB 고정으로 충분하다 */
function formatGB(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
}

type GaugeLevel = "OK" | "WARNING" | "BLOCKED";

/**
 * 임계값을 **응답에서 읽는다** — 80/95를 화면에 상수로 박으면 서버가
 * 정책을 바꿨을 때 화면이 거짓말을 한다 (SPEC_API §8.5가 임계값을 응답에
 * 실어 보내는 이유).
 */
function levelOf(usage: StorageUsage): GaugeLevel {
  if (usage.uploadBlocked || usage.usagePercent >= usage.blockThreshold) return "BLOCKED";
  if (usage.usagePercent >= usage.warningThreshold) return "WARNING";
  return "OK";
}

const LEVEL_BADGE: Record<GaugeLevel, string> = {
  OK: "여유",
  WARNING: "경고",
  BLOCKED: "업로드 차단",
};

/*
 * 세 단계가 **눈으로 구분돼야 한다** — 같은 게이지가 42%와 96%에서 똑같이
 * 보이면 표시가 있는 의미가 없다 (WIREFRAME.md §15 "한도를 모르는 채 올리다
 * 과금이 시작되면 안 된다").
 *
 * 팔레트에 앰버가 없어서(globals.css) 경고/차단을 같은 `--color-red-500`으로
 * 쓰되 **채움 방식**을 다르게 한다: 경고는 테두리형 배너, 차단은 꽉 찬 배너.
 * 근거는 `/admin/posts/new`의 PostForm 주석과 동일하다 — 개편된 팔레트에서
 * `--color-yellow`는 초록(CTA)이라 경고로 읽히지 않는다.
 */
const BAR_CLASS: Record<GaugeLevel, string> = {
  OK: "bg-[var(--color-yellow)]",
  WARNING: "bg-[var(--color-red-500)]/70",
  BLOCKED: "bg-[var(--color-red-500)]",
};

const BADGE_CLASS: Record<GaugeLevel, string> = {
  OK: "bg-[var(--color-navy-100)] text-[var(--color-ink)]",
  WARNING: "border border-[var(--color-red-500)] text-[var(--color-red-500)]",
  BLOCKED: "bg-[var(--color-red-500)] text-[var(--color-danger-fg)]",
};

/**
 * WIREFRAME.md §15 "저장 공간" — FR-ADM-01, FR-PHO-10 (SPEC_API §8.5).
 *
 * 권한은 `L` 이상이라 관리 홈에 들어온 사용자 전원이 본다 (회원 관리와 달리
 * 전도사 전용이 아니다).
 */
export function StorageGauge() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "storage"],
    queryFn: () => api.admin.storage(),
  });

  if (isLoading) {
    return <p className="text-sm text-[var(--color-gray-400)]">저장 공간을 확인하는 중...</p>;
  }

  if (isError || !data) {
    const forbidden = isApiError(error) && error.code === "FORBIDDEN";
    return (
      <p role="alert" className="text-sm text-[var(--color-red-500)]">
        {forbidden
          ? "저장 공간을 확인할 권한이 없습니다."
          : isApiError(error)
            ? error.message
            : "저장 공간을 확인하지 못했습니다."}
      </p>
    );
  }

  const level = levelOf(data);
  // 100%를 넘겨도 막대가 컨테이너를 삐져나가지 않게 자른다
  const width = Math.min(100, Math.max(0, data.usagePercent));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold">
          {formatGB(data.usedBytes)} / {formatGB(data.limitBytes)}
        </span>
        <span
          className={`rounded-[var(--radius-button)] px-3 py-1 text-xs font-bold ${BADGE_CLASS[level]}`}
        >
          {data.usagePercent.toFixed(1)}% · {LEVEL_BADGE[level]}
        </span>
      </div>

      {/*
        progressbar 역할을 주고 aria-valuetext로 퍼센트를 읽히게 한다 —
        색만으로 상태를 전달하면 색을 구분하지 못하는 사용자에게는 정보가
        사라진다 (NFR-A11Y). 위 배지 텍스트가 그 역할을 겸한다.
      */}
      <div
        role="progressbar"
        aria-label="저장 공간 사용량"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(data.usagePercent)}
        aria-valuetext={`${data.usagePercent.toFixed(1)}% 사용 중`}
        className="mt-2 h-3 w-full overflow-hidden rounded-[var(--radius-button)] bg-[var(--color-navy-100)]"
      >
        <div className={`h-full rounded-[var(--radius-button)] ${BAR_CLASS[level]}`} style={{ width: `${width}%` }} />
      </div>

      <p className="mt-2 text-sm text-[var(--color-gray-400)]">
        사진 {data.photoCount.toLocaleString()}장 · 여유 약{" "}
        {data.estimatedRemainingPhotos.toLocaleString()}장
      </p>

      {level === "WARNING" && (
        <p
          role="alert"
          className="mt-3 rounded-[var(--radius-card)] border border-[var(--color-red-500)] px-4 py-3 text-sm font-bold text-[var(--color-red-500)]"
        >
          ⚠️ 저장 공간이 {data.warningThreshold}%를 넘었습니다. {data.blockThreshold}%에
          도달하면 사진 업로드가 차단됩니다.
        </p>
      )}

      {level === "BLOCKED" && (
        <p
          role="alert"
          className="mt-3 rounded-[var(--radius-card)] bg-[var(--color-red-500)] px-4 py-3 text-sm font-bold text-[var(--color-danger-fg)]"
        >
          ⛔ 저장 공간이 {data.blockThreshold}%를 넘어 사진 업로드가 차단되었습니다.
          기존 사진을 정리한 뒤 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}
