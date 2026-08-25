"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { defaultWindow, localInputToIso } from "../../_components/meetingWindow";

/**
 * 진행 단계.
 *
 * `converting`은 **서버가 PDF를 페이지 이미지로 바꾸는 동안**이다. 요청 하나가
 * 15~30초 동안 응답하지 않으므로, 이 단계를 화면에 그리지 않으면 사용자는
 * 실패로 읽고 버튼을 다시 누른다.
 */
type Phase =
  | { kind: "idle" }
  | { kind: "converting" }
  | { kind: "done"; id: string; pageCount: number };

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

function formatSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb < 1 ? `${(bytes / 1024).toFixed(0)}KB` : `${mb.toFixed(1)}MB`;
}

/**
 * WIREFRAME.md §21 — 월례회 자료 업로드 (SPEC_API §7.4, 권한 `L`).
 *
 * `react-hook-form`을 쓰지 않는다 — 입력이 텍스트 셋 + 파일 하나이고, 검증도
 * "기간 순서"와 "PDF인가" 둘뿐이라 폼 라이브러리가 관리할 것이 거의 없다
 * (주보 업로드 폼과 같은 판단).
 *
 * ⚠️ **이 화면에서 가장 중요한 UI는 입력 필드가 아니라 경고 문구다**
 * (WIREFRAME §21). 캡처를 막았다고 믿고 더 민감한 자료를 올리는 것이 이
 * 기능의 최악의 결과다 (ARCHITECTURE §7.7).
 */
export function MeetingUploadForm() {
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [viewableFrom, setViewableFrom] = useState("");
  const [viewableUntil, setViewableUntil] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const titleId = useId();
  const dateId = useId();
  const fromId = useId();
  const untilId = useId();
  const queryClient = useQueryClient();

  const busy = phase.kind === "converting";

  /*
    변환 중 이탈 경고. 여기서 창을 닫으면 서버는 변환을 마치고도 그 결과를
    돌려줄 곳이 없다 — 사용자는 올라갔는지 아닌지 모르는 상태로 남는다.
  */
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  /*
    경과 시간을 1초마다 다시 그린다.

    ⚠️ 와이어프레임 §21-1은 `7 / 10 페이지` 진행률을 그리라고 했지만 **그건
    만들 수 없다.** §7.4는 변환이 다 끝나야 응답이 오는 요청 하나라서, 지금
    몇 페이지째인지 FE로 오는 정보가 없다. 있지도 않은 진행률을 그럴듯하게
    움직이면 그건 거짓말이고, 실패했을 때도 계속 차오른다.
    그래서 알 수 있는 것(경과 시간)만 보여주고 예상 소요를 함께 적는다.
  */
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) return;
    // 0으로 되돌리는 것은 제출 시점(handleSubmit)에서 한다 — 이펙트 안에서
    // setState하면 렌더 직후 한 번 더 렌더가 돌고, 린트도 이를 막는다
    const t = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  function handleDateChange(next: string) {
    setMeetingDate(next);
    // 기간을 아직 손대지 않았을 때만 기본값을 채운다 — 사용자가 정한 값을 덮지 않는다
    if (!viewableFrom && !viewableUntil) {
      const w = defaultWindow(next);
      setViewableFrom(w.from);
      setViewableUntil(w.until);
    }
  }

  function handleFile(list: FileList | null) {
    setFileError(null);
    const picked = list?.[0] ?? null;
    if (!picked) return;

    /*
      확장자·MIME으로 거를 수 있는 것은 "PDF가 아닌 파일"까지다.
      암호가 걸렸거나 손상된 PDF는 서버가 열어봐야 안다 (SPEC_API §7.4).
      그래서 여기를 통과했다고 변환에 성공한다는 뜻이 아니다.
    */
    const isPdf =
      picked.type === "application/pdf" || picked.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setFileError("PDF 파일만 올릴 수 있습니다. Word에서 「PDF로 저장」해 주세요.");
      setFile(null);
      return;
    }
    setFile(picked);
  }

  async function handleSubmit() {
    setError(null);
    setFileError(null);

    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) {
      setError("월례회 일자를 선택해주세요.");
      return;
    }
    if (!viewableFrom || !viewableUntil) {
      setError("열람 기간을 입력해주세요.");
      return;
    }
    // 서버도 막지만(§7.4) 왕복 30초를 기다린 뒤 거부당할 이유가 없다
    if (new Date(viewableUntil).getTime() <= new Date(viewableFrom).getTime()) {
      setError("열람 종료는 시작보다 뒤여야 합니다.");
      return;
    }
    if (!file) {
      setFileError("PDF 파일을 선택해주세요.");
      return;
    }

    setElapsed(0);
    setPhase({ kind: "converting" });
    try {
      const result = await api.meetings.create({
        title: title.trim(),
        meetingDate,
        viewableFrom: localInputToIso(viewableFrom),
        viewableUntil: localInputToIso(viewableUntil),
        file,
      });
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      setPhase({ kind: "done", id: result.id, pageCount: result.pageCount });
    } catch (cause) {
      setPhase({ kind: "idle" });
      if (isApiError(cause) && cause.field === "file") {
        setFileError(cause.message);
        return;
      }
      if (isApiError(cause) && cause.code === "STORAGE_LIMIT") {
        setError(
          `${cause.message} 오래된 앨범이나 자료를 정리한 뒤 다시 시도해주세요 (관리 홈에서 사용량을 볼 수 있습니다).`,
        );
        return;
      }
      setError(
        isApiError(cause)
          ? cause.message
          : "자료를 올리지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    }
  }

  // ── 변환 중 ──────────────────────────────────────────────
  if (phase.kind === "converting") {
    return (
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">자료를 변환하고 있습니다</h1>
        {/* 진행 상황이 스크린리더에도 전달돼야 한다 */}
        <div role="status" aria-live="polite" className="mt-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-navy-100)]">
            {/*
              길이가 진행률을 뜻하지 않는다 — 알 수 없으므로 무한 반복
              애니메이션으로 "일하는 중"만 표현한다.
            */}
            <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--color-yellow)]" />
          </div>
          <p className="mt-4 text-base font-bold">{elapsed}초 경과</p>
          <p className="mt-1 text-sm text-[var(--color-gray-400)]">
            서버가 PDF를 페이지 이미지로 바꾸는 중입니다. 10페이지 기준 15~30초쯤
            걸립니다.
          </p>
          <p className="mt-4 text-sm font-bold text-[var(--color-red-500)]">
            창을 닫거나 새로고침하지 마세요. 처음부터 다시 올려야 합니다.
          </p>
        </div>
      </Section>
    );
  }

  // ── 완료 ─────────────────────────────────────────────────
  if (phase.kind === "done") {
    return (
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">올렸습니다 🎉</h1>
        <p className="mt-2 text-[var(--color-gray-400)]">
          {title.trim()} · {phase.pageCount}페이지로 변환됐습니다.
        </p>
        <p className="mt-4 text-sm text-[var(--color-gray-400)]">
          올린 PDF 원본은 서버에 남지 않습니다. 원본이 필요하면 본인 컴퓨터에
          보관해 주세요.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/admin/meetings/${phase.id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
          >
            열람 기간 확인·수정
          </Link>
          <Link
            href="/my/meetings"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-6 text-base font-bold transition hover:bg-[var(--color-navy-100)]"
          >
            자료 목록
          </Link>
        </div>
      </Section>
    );
  }

  // ── 입력 ─────────────────────────────────────────────────
  return (
    <Section>
      <Link
        href="/admin"
        className="text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-navy-900)]"
      >
        ← 관리
      </Link>
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">월례회 자료 업로드</h1>

      <div className="mt-8 space-y-6">
        <div>
          <label htmlFor={titleId} className="text-sm font-bold">
            제목
          </label>
          <input
            id={titleId}
            type="text"
            className={`${inputClass} mt-2`}
            placeholder="2026년 8월 월례회"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor={dateId} className="text-sm font-bold">
            월례회 일자
          </label>
          <input
            id={dateId}
            type="date"
            className={`${inputClass} mt-2`}
            value={meetingDate}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-bold">열람 기간</legend>
          <p className="mt-1 text-sm text-[var(--color-gray-400)]">
            종료 후 회원은 열람할 수 없습니다. 임원은 기간과 무관하게 볼 수 있습니다.
            나중에 연장하거나 일찍 닫을 수 있습니다.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={fromId} className="text-sm text-[var(--color-gray-400)]">
                시작
              </label>
              <input
                id={fromId}
                type="datetime-local"
                className={`${inputClass} mt-1`}
                value={viewableFrom}
                onChange={(e) => setViewableFrom(e.target.value)}
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
                value={viewableUntil}
                onChange={(e) => setViewableUntil(e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <div>
          <p className="text-sm font-bold">자료 파일</p>
          <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold text-[var(--color-navy-900)] transition hover:brightness-95">
            + PDF 선택
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => {
                handleFile(e.target.files);
                // 같은 파일을 다시 고를 수 있게 초기화한다
                e.target.value = "";
              }}
            />
          </label>

          {file && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] px-4 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">📄 {file.name}</span>
              <span className="text-[var(--color-gray-400)]">{formatSize(file.size)}</span>
              <button
                type="button"
                aria-label={`${file.name} 제거`}
                className="rounded-md px-2 py-1 text-[var(--color-gray-400)] hover:bg-[var(--color-navy-100)]"
                onClick={() => setFile(null)}
              >
                ✕
              </button>
            </div>
          )}

          {fileError && (
            <p role="alert" className="mt-2 text-sm text-[var(--color-red-500)]">
              {fileError}
            </p>
          )}

          <p className="mt-3 text-sm text-[var(--color-gray-400)]">
            Word에서 「다른 이름으로 저장 → PDF」로 저장한 뒤 올려주세요. 서버가
            페이지 이미지로 바꿉니다. 페이지 순서는 PDF 순서를 그대로 따릅니다.
          </p>
          <p className="mt-1 text-sm text-[var(--color-gray-400)]">
            암호가 걸렸거나 손상된 PDF는 파일을 고를 때가 아니라 변환을 시도할 때
            드러납니다.
          </p>
        </div>

        {/*
          ★ 이 블록이 이 화면의 핵심이다 (WIREFRAME §21).
            뷰어(`MeetingViewer`)·목록(`MeetingList`)과 **같은 톤**으로 적는다 —
            한 화면에서만 정직하면 다른 화면을 본 사람은 여전히 오해한다.
        */}
        <div
          role="note"
          className="rounded-[var(--radius-card)] border border-[var(--color-red-500)] bg-[var(--color-red-500)]/10 p-4"
        >
          <p className="text-sm font-bold">⚠️ 올리기 전에 확인해 주세요</p>
          <p className="mt-2 text-sm">
            화면 캡처를 기술적으로 막을 방법은 없습니다. 열람자의 이름·연락처
            뒷자리·열람 시각이 워터마크로 찍히므로 <b>유출 시 추적만 가능</b>합니다.
            막아준다고 믿고 올릴 자료가 아니라면 올리지 말아 주세요.
          </p>
          <p className="mt-2 text-sm">
            올린 PDF 원본은 서버에 보관하지 않습니다. 페이지 이미지만 남습니다.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-[var(--color-red-500)]">
            {error}
          </p>
        )}

        <Button type="button" onClick={handleSubmit} disabled={busy}>
          업로드
        </Button>
      </div>
    </Section>
  );
}
