"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import type { AttendanceSessionSummary, AttendanceSessionType } from "@/types/api";

/** "8/24 (일)" — 회차는 날짜가 정체성이라 요일까지 보여준다 */
function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const day = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${day})`;
}

const TYPE_LABEL: Record<AttendanceSessionType, string> = {
  SUNDAY_SERVICE: "주일예배",
  ETC: "기타 모임",
};

/**
 * 출석부 회차 목록 + 회차 만들기 (브리핑 2026-08-28 §7 — `GET/POST /attendance/sessions`).
 *
 * 만들기 폼을 별도 페이지로 빼지 않은 이유: 입력이 날짜·이름 둘뿐이고,
 * 임원의 주 사용 흐름이 "주일 아침에 열어서 → 오늘 회차 만들고 → 바로 체크"라
 * 화면 전환이 한 번 늘어나는 것이 그대로 비용이다. 생성 성공 시 체크 화면으로
 * 바로 보낸다.
 */
export function SessionList() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["attendance", "sessions"],
    queryFn: () => api.attendance.sessions(),
  });

  if (isLoading) {
    return (
      <Section className="pt-8">
        <p className="text-[var(--color-gray-400)]">불러오는 중...</p>
      </Section>
    );
  }

  if (isError) {
    // UI 게이트를 통과했어도 최종 판단은 서버다
    const forbidden = isApiError(error) && error.code === "FORBIDDEN";
    return (
      <Section className="pt-8">
        <p role="alert" className="text-[var(--color-red-500)]">
          {forbidden
            ? "출석부를 사용할 권한이 없습니다."
            : isApiError(error)
              ? error.message
              : "회차 목록을 불러오지 못했습니다."}
        </p>
      </Section>
    );
  }

  const items: AttendanceSessionSummary[] = data?.items ?? [];

  return (
    <Section className="pt-8">
      <CreateSessionForm />

      {items.length === 0 ? (
        <p className="mt-8 text-[var(--color-gray-400)]">
          아직 회차가 없습니다. 위에서 첫 회차를 만들어주세요.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-[var(--color-navy-100)] border-y border-[var(--color-navy-100)]">
          {items.map((session) => (
            <li key={session.id}>
              <Link
                href={`/admin/attendance/${session.id}`}
                className="flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-1 py-4"
              >
                <span className="font-bold">{formatDate(session.date)}</span>
                <span className="font-bold">{session.title}</span>
                <span className="text-sm text-[var(--color-gray-400)]">
                  {TYPE_LABEL[session.type]}
                </span>
                {/*
                  "체크 4/15"는 진행 상태다 — 주일 낮에 목록만 봐도 어느 마을
                  임원이 아직 체크 전인지 짐작할 수 있다. 다 체크됐으면 출석
                  인원만 보여준다 (완료된 회차에서 15/15는 정보가 아니다).
                */}
                <span className="ml-auto shrink-0 text-sm text-[var(--color-gray-400)]">
                  {session.checkedCount < session.rosterCount
                    ? `체크 ${session.checkedCount}/${session.rosterCount}`
                    : `출석 ${session.presentCount}명`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** 오늘 날짜 "YYYY-MM-DD" (로컬 기준 — 출석은 교회가 있는 시간대의 하루다) */
function todayLocalISO(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function CreateSessionForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayLocalISO);
  const [type, setType] = useState<AttendanceSessionType>("SUNDAY_SERVICE");
  const [title, setTitle] = useState("주일예배");
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.attendance.createSession({ date, type, title }),
    onSuccess: ({ id }) => {
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["attendance", "sessions"] });
      // 주 사용 흐름: 만들자마자 체크를 시작한다
      router.push(`/admin/attendance/${id}`);
    },
    onError: (error) => {
      setFormError(
        isApiError(error) ? error.message : "회차를 만들지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    },
  });

  const inputClass =
    "min-h-11 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

  return (
    <form
      className="rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h2 className="text-sm font-bold text-[var(--color-gray-400)]">회차 만들기</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        <div className="flex flex-col">
          <label htmlFor="attendance-date" className="mb-1 text-sm font-bold">
            날짜
          </label>
          <input
            id="attendance-date"
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="attendance-type" className="mb-1 text-sm font-bold">
            종류
          </label>
          <select
            id="attendance-type"
            className={inputClass}
            value={type}
            onChange={(e) => {
              const next = e.target.value as AttendanceSessionType;
              setType(next);
              // 이름을 직접 고치지 않았을 때만 종류에 맞는 기본 이름으로 따라간다
              if (title === TYPE_LABEL.SUNDAY_SERVICE || title === TYPE_LABEL.ETC) {
                setTitle(TYPE_LABEL[next]);
              }
            }}
          >
            <option value="SUNDAY_SERVICE">주일예배</option>
            <option value="ETC">기타 모임</option>
          </select>
        </div>
        <div className="flex min-w-40 flex-1 flex-col">
          <label htmlFor="attendance-title" className="mb-1 text-sm font-bold">
            이름
          </label>
          <input
            id="attendance-title"
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "만드는 중..." : "만들고 체크 시작"}
          </Button>
        </div>
      </div>
      {formError && (
        <p role="alert" className="mt-3 text-sm text-[var(--color-red-500)]">
          {formError}
        </p>
      )}
    </form>
  );
}
