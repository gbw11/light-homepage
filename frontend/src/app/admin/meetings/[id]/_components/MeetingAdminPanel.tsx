"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import {
  formatWindow,
  isoToLocalInput,
  localInputToIso,
} from "../../_components/meetingWindow";
import type { MeetingStatus } from "@/types/api";

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

const STATUS_LABEL: Record<MeetingStatus, string> = {
  SCHEDULED: "열람 시작 전",
  OPEN: "열람 중",
  CLOSED: "종료됨",
};

/**
 * 월례회 열람 기간 수정·삭제 `/admin/meetings/[id]` (SPEC_API §7.5 · §7.6).
 *
 * ## 왜 상세(`§7.2`)가 아니라 목록(`§7.1`)에서 자료를 찾는가
 *
 * 기간 수정 폼은 시작·종료 **둘 다** 채워야 하는데, `§7.2`의 응답에는
 * `viewableUntil`만 있고 `viewableFrom`이 없다. 회원용 뷰어는 "언제까지"만
 * 알면 되니 그 스펙이 틀린 건 아니지만, 관리 화면에는 모자란다.
 * 목록(`§7.1`)은 둘 다 주므로 거기서 찾는다. 자료 수가 많지 않아(2개월에
 * 하나) 비용 문제가 아니다. 상세에 `viewableFrom`을 넣는 편이 깔끔해서
 * `BACKEND_HANDOFF`에 올려뒀다.
 */
export function MeetingAdminPanel({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fromId = useId();
  const untilId = useId();

  const {
    data: meeting,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["meetings", "admin-lookup"],
    // 관리 화면이라 캐시된 옛 기간을 폼 초기값으로 쓰면 안 된다
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const page = await api.meetings.list({ size: 100 });
      return page.items.find((m) => m.id === id) ?? null;
    },
  });

  /*
    편집한 값만 들고 있고, 손대지 않았으면 불러온 값을 그대로 보여준다.
    이펙트로 초기값을 밀어 넣지 않는 이유: 그러면 조회 결과가 갱신될 때마다
    사용자가 입력하던 값이 되돌아갈 수 있고, 렌더가 한 번 더 돈다.
    `null` = "아직 손대지 않음"이다.
  */
  const [edited, setEdited] = useState<{ from: string; until: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [typed, setTyped] = useState("");
  const [dangerOpen, setDangerOpen] = useState(false);

  const save = useMutation({
    mutationFn: (next: { from: string; until: string }) =>
      api.meetings.updateWindow(id, {
        viewableFrom: localInputToIso(next.from),
        viewableUntil: localInputToIso(next.until),
      }),
    onSuccess: async () => {
      setSaved(true);
      setError(null);
      // 서버가 받아들인 값이 새 기준이다 — 편집 표시를 지워 조회 결과를 따르게 한다
      setEdited(null);
      // 목록·뷰어가 모두 이 접두사에 걸린다. 갱신하지 않으면 회원 화면에
      // 옛 기간이 남아 "종료됐다"거나 "아직 열려 있다"고 잘못 말한다
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (err) => {
      setSaved(false);
      setError(
        isApiError(err) ? err.message : "기간을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    },
  });

  const remove = useMutation({
    mutationFn: () => api.meetings.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      // 지운 자료의 관리 화면에 머무를 수 없다 (다음 조회는 404다)
      router.replace("/meetings");
    },
    onError: (err) => {
      setError(
        isApiError(err) ? err.message : "자료를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    },
  });

  if (isLoading) {
    return (
      <Section>
        <p className="text-[var(--color-gray-400)]">불러오는 중...</p>
      </Section>
    );
  }

  if (isError || !meeting) {
    return (
      <Section>
        <p role="alert" className="text-[var(--color-red-500)]">
          찾을 수 없는 자료입니다.
        </p>
        <Link
          href="/meetings"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-bold hover:underline"
        >
          ← 월례회 자료
        </Link>
      </Section>
    );
  }

  const confirmed = typed.trim() === meeting.title.trim();
  const busy = save.isPending || remove.isPending;
  const from = edited?.from ?? isoToLocalInput(meeting.viewableFrom);
  const until = edited?.until ?? isoToLocalInput(meeting.viewableUntil);

  function handleSave() {
    setError(null);
    setSaved(false);
    if (!from || !until) {
      setError("열람 기간을 입력해주세요.");
      return;
    }
    // 서버도 막지만 왕복하기 전에 알려준다 (SPEC_API §7.5)
    if (new Date(until).getTime() <= new Date(from).getTime()) {
      setError("열람 종료는 시작보다 뒤여야 합니다.");
      return;
    }
    save.mutate({ from, until });
  }

  function handleDelete() {
    if (!confirmed || !meeting) return;
    const ok = window.confirm(
      `${meeting.title}을(를) 삭제할까요?\n\n${meeting.pageCount}페이지의 이미지가 함께 지워지고 되돌릴 수 없습니다.`,
    );
    if (!ok) return;
    setError(null);
    remove.mutate();
  }

  return (
    <Section>
      <Link
        href="/admin"
        className="text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-ink)]"
      >
        ← 관리
      </Link>
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">{meeting.title}</h1>
      <p className="mt-2 text-sm text-[var(--color-gray-400)]">
        월례회 {meeting.meetingDate} · {meeting.pageCount}페이지 ·{" "}
        {STATUS_LABEL[meeting.status]}
      </p>
      <p className="mt-1 text-sm text-[var(--color-gray-400)]">
        현재 열람 기간: {formatWindow(meeting.viewableFrom, meeting.viewableUntil)}
      </p>

      <div className="mt-4">
        <Link
          href={`/admin/meetings/${id}/views`}
          className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-4 text-sm font-bold transition hover:bg-[var(--color-navy-100)]"
        >
          열람 기록 보기
        </Link>
      </div>

      {/* ── 열람 기간 수정 ─────────────────────────────── */}
      <div className="mt-10 border-t border-[var(--color-navy-100)] pt-8">
        <h2 className="text-lg font-bold">열람 기간 수정</h2>
        <p className="mt-1 text-sm text-[var(--color-gray-400)]">
          연장과 조기 종료를 여기서 함께 합니다. 종료 시각을 지금보다 앞으로
          당기면 회원은 곧바로 열람할 수 없게 됩니다. 임원은 기간과 무관하게
          계속 볼 수 있습니다.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={fromId} className="text-sm text-[var(--color-gray-400)]">
              시작
            </label>
            <input
              id={fromId}
              type="datetime-local"
              className={`${inputClass} mt-1`}
              value={from}
              onChange={(e) => {
                setEdited({ from: e.target.value, until });
                setSaved(false);
              }}
            />
          </div>
          <div>
            <label htmlFor={untilId} className="text-sm text-[var(--color-gray-400)]">
              종료
            </label>
            <input
              id={untilId}
              type="datetime-local"
              className={`${inputClass} mt-1`}
              value={until}
              onChange={(e) => {
                setEdited({ from, until: e.target.value });
                setSaved(false);
              }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={handleSave} disabled={busy}>
            {save.isPending ? "저장 중…" : "기간 저장"}
          </Button>
          {saved && (
            <p role="status" className="text-sm font-bold">
              저장했습니다.
            </p>
          )}
        </div>
      </div>

      {/* ── 삭제 ───────────────────────────────────────── */}
      <div className="mt-10 border-t border-[var(--color-navy-100)] pt-8">
        <h2 className="text-lg font-bold">자료 삭제</h2>
        {!dangerOpen ? (
          <button
            type="button"
            className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-[var(--color-red-500)] hover:underline"
            onClick={() => setDangerOpen(true)}
          >
            이 자료를 삭제합니다
          </button>
        ) : (
          <div className="mt-3">
            <p className="text-sm">
              페이지 이미지 {meeting.pageCount}장이 함께 지워지고{" "}
              <b>되돌릴 수 없습니다.</b> 원본 PDF는 서버에 없으므로 다시 올리려면
              올린 사람의 파일이 필요합니다.
            </p>
            {/*
              제목을 손으로 옮겨 적게 한다 — `AlbumDangerZone`과 같은 무게다.
              확인 창 하나만 두면 반사적으로 Enter를 눌러 넘길 수 있고,
              무엇보다 **어느 자료인지**를 확인시키지 못한다.
            */}
            <label className="mt-4 block text-sm font-bold">
              지우려면 제목을 그대로 입력하세요: {meeting.title}
              <input
                type="text"
                className={`${inputClass} mt-2`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={!confirmed || busy}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-red-500)] px-6 text-base font-bold text-[var(--color-danger-fg)] transition hover:brightness-95 disabled:opacity-40"
              onClick={handleDelete}
            >
              {remove.isPending ? "삭제 중…" : "삭제"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm text-[var(--color-red-500)]">
          {error}
        </p>
      )}
    </Section>
  );
}
