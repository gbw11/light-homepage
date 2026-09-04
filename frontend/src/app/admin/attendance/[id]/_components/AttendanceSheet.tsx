"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import type {
  AttendanceEntry,
  AttendanceStatus,
  Village,
} from "@/types/api";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "출석",
  LATE: "지각",
  ABSENT: "결석",
  EXCUSED: "공결",
};

/** 버튼 나열 순서 — 가장 많이 누르는 것(출석)이 항상 맨 앞 */
const STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];

/** 상태별 선택 색 — 출석/지각은 긍정, 결석은 경고, 공결은 중립 */
const SELECTED_CLASS: Record<AttendanceStatus, string> = {
  PRESENT: "bg-[var(--color-yellow)] text-[var(--color-accent-fg)] border-transparent",
  LATE: "bg-[var(--color-yellow)] text-[var(--color-accent-fg)] border-transparent opacity-70",
  ABSENT: "bg-[var(--color-red-500)] text-white border-transparent",
  EXCUSED: "bg-[var(--color-navy-100)] text-[var(--color-ink)] border-transparent",
};

/** "8/24 (일)" — SessionList와 같은 표기 */
function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const day = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${day})`;
}

/**
 * ⚠️ `null`을 함께 다룬다 — 명단 CSV에 마을 열이 비어 있는 사람이 있다
 * (`AttendanceEntry.village` 주석). `lib/village.ts`의 것과 다른 이유가
 * 이것이고, 그쪽은 마을이 반드시 있는 회원 화면이 쓴다.
 */
function villageLabel(village: Village | null): string {
  if (village === null) return "마을 미배정";
  return village === "newcomer" ? "새가족" : `${village}마을`;
}

/**
 * 출석 체크 시트 (브리핑 2026-08-28 §7).
 *
 * ## 저장 방식 — 손댄 것만 모아서 한 번에 (upsert)
 *
 * 탭마다 서버에 쏘지 않는다. 주일 현장은 회선이 나쁘고(지하·사람 밀집)
 * 15~50명을 연속으로 탭하는 흐름이라, 탭 하나하나가 요청이면 실패 재시도가
 * 체크 흐름을 끊는다. 대신 로컬에 쌓고 [저장]에서 **변경분만** PUT한다 —
 * §7의 upsert 의미론과 맞물려, 동시에 체크하는 다른 임원의 기록을 덮지 않는다.
 *
 * 저장 전 이탈은 브라우저 확인창으로 막지 않는다 — 대신 저장 버튼에
 * 미저장 개수를 항상 표시해 "저장 안 했다"가 화면에 보이게 한다.
 */
export function AttendanceSheet({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["attendance", "session", sessionId],
    queryFn: () => api.attendance.session(sessionId),
  });

  /** rosterId → 화면에서 바꾼 상태. 서버 값과 같아지면 지운다 */
  const [draft, setDraft] = useState<Map<string, AttendanceStatus>>(new Map());
  const [savedNotice, setSavedNotice] = useState(false);

  const mutation = useMutation({
    mutationFn: (entries: { rosterId: string; status: AttendanceStatus }[]) =>
      api.attendance.saveEntries(sessionId, entries),
    onSuccess: () => {
      setDraft(new Map());
      setSavedNotice(true);
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  // 마을 단위로 묶는다 — 임원이 자기 마을부터 훑는 흐름 (§7 마을 정렬 전제)
  const groups = useMemo(() => {
    const byVillage = new Map<Village | null, AttendanceEntry[]>();
    for (const entry of data?.entries ?? []) {
      const list = byVillage.get(entry.village) ?? [];
      list.push(entry);
      byVillage.set(entry.village, list);
    }
    return [...byVillage.entries()];
  }, [data]);

  if (isLoading) {
    return (
      <Section className="pt-8">
        <p className="text-[var(--color-gray-400)]">명단을 불러오는 중...</p>
      </Section>
    );
  }

  if (isError || !data) {
    const notFound = isApiError(error) && error.code === "NOT_FOUND";
    return (
      <Section className="pt-8">
        <p role="alert" className="text-[var(--color-red-500)]">
          {notFound
            ? "회차를 찾을 수 없습니다. 삭제됐을 수 있습니다."
            : isApiError(error)
              ? error.message
              : "명단을 불러오지 못했습니다."}
        </p>
      </Section>
    );
  }

  const effectiveStatus = (entry: AttendanceEntry): AttendanceStatus | null =>
    draft.get(entry.rosterId) ?? entry.status;

  const checkedCount = data.entries.filter((e) => effectiveStatus(e) !== null).length;

  const setStatus = (entry: AttendanceEntry, status: AttendanceStatus) => {
    setSavedNotice(false);
    setDraft((prev) => {
      const next = new Map(prev);
      if (entry.status === status) {
        // 서버 값과 같아졌다 — 변경분이 아니므로 draft에서 뺀다
        next.delete(entry.rosterId);
      } else {
        next.set(entry.rosterId, status);
      }
      return next;
    });
  };

  const save = () => {
    const entries = [...draft.entries()].map(([rosterId, status]) => ({ rosterId, status }));
    if (entries.length > 0) mutation.mutate(entries);
  };

  return (
    <Section className="pt-6">
      <h1 className="text-2xl font-bold md:text-3xl">
        {formatDate(data.date)} {data.title}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-gray-400)]">
        체크 {checkedCount}/{data.entries.length}
      </p>

      <div className="mt-6 space-y-8 pb-28">
        {groups.map(([village, entries]) => (
          <section key={village ?? "none"} aria-label={villageLabel(village)}>
            <h2 className="mb-2 text-sm font-bold text-[var(--color-gray-400)]">
              {villageLabel(village)}
            </h2>
            <ul className="divide-y divide-[var(--color-navy-100)] border-y border-[var(--color-navy-100)]">
              {entries.map((entry) => {
                const current = effectiveStatus(entry);
                return (
                  <li
                    key={entry.rosterId}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
                  >
                    <span className="font-bold">
                      {entry.name}
                      {draft.has(entry.rosterId) && (
                        <span aria-label="저장 안 됨" className="ml-1 text-[var(--color-yellow)]">
                          •
                        </span>
                      )}
                    </span>
                    {/*
                      radiogroup이 아니라 개별 토글 버튼이다: 미체크(null)
                      상태가 있어서 "아무것도 선택 안 됨"이 유효한 상태이고,
                      각 버튼이 aria-pressed로 자기 상태를 말하는 쪽이
                      스크린리더에 더 정직하다.
                    */}
                    <span className="flex gap-1" role="group" aria-label={`${entry.name} 출결`}>
                      {STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          aria-pressed={current === status}
                          onClick={() => setStatus(entry, status)}
                          className={`min-h-11 min-w-11 rounded-[var(--radius-button)] border px-2 text-sm font-bold transition ${
                            current === status
                              ? SELECTED_CLASS[status]
                              : "border-[var(--color-navy-100)] text-[var(--color-gray-400)] hover:text-[var(--color-ink)]"
                          }`}
                        >
                          {STATUS_LABEL[status]}
                        </button>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/*
        저장 바는 화면 하단 고정 — 50명 명단을 스크롤하는 동안 어디서든
        저장할 수 있어야 하고, 미저장 개수가 항상 눈에 보여야 한다.
      */}
      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--color-navy-100)] bg-[var(--background)] px-5 py-3">
        <div className="mx-auto flex w-full max-w-[var(--container-max)] items-center justify-between gap-4 md:px-5">
          <p aria-live="polite" className="text-sm text-[var(--color-gray-400)]">
            {mutation.isError ? (
              <span role="alert" className="font-bold text-[var(--color-red-500)]">
                {isApiError(mutation.error)
                  ? mutation.error.message
                  : "저장하지 못했습니다. 다시 시도해주세요."}
              </span>
            ) : draft.size > 0 ? (
              <span className="font-bold text-[var(--color-ink)]">
                저장 안 된 체크 {draft.size}건
              </span>
            ) : savedNotice ? (
              "저장됐습니다"
            ) : (
              "바뀐 것이 없습니다"
            )}
          </p>
          <Button
            type="button"
            onClick={save}
            disabled={draft.size === 0 || mutation.isPending}
          >
            {mutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>
    </Section>
  );
}
