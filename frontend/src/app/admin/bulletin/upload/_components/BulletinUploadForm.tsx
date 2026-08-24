"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { BULLETIN_MAX_EDGE, ResizeError, resizeToWebp } from "@/lib/image/resize";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { PageOrderList } from "./PageOrderList";
import { move, nextPageId, type PendingPage } from "./pages";

/**
 * 진행 단계.
 *
 * 변환과 전송을 나눠 보여준다 — 4장을 2048px WebP로 줄이는 데 몇 초가 걸리는데,
 * 그동안 "업로드 중"만 뜨면 멈춘 것처럼 보인다.
 */
type Phase =
  | { kind: "idle" }
  | { kind: "converting"; done: number; total: number }
  | { kind: "uploading" }
  | { kind: "done"; pageCount: number };

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

/**
 * WIREFRAME.md §17 — 주보 업로드 폼 (FR-BUL-05).
 *
 * 다른 폼들과 달리 `react-hook-form`을 쓰지 않는다. 입력이 **날짜 하나 +
 * 순서가 있는 파일 목록**이고, 값의 대부분이 파일 배열이라 폼 라이브러리가
 * 관리할 것이 거의 없다 (`CONVENTIONS.md §4`의 폼 규칙은 필드가 여러 개인
 * 입력을 전제한다).
 */
export function BulletinUploadForm() {
  const [serviceDate, setServiceDate] = useState("");
  const [pages, setPages] = useState<PendingPage[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dateId = useId();
  const queryClient = useQueryClient();

  const busy = phase.kind === "converting" || phase.kind === "uploading";

  /*
    objectURL은 문서가 살아있는 동안 계속 메모리를 붙잡는다. 언마운트 때
    한 번에 풀어준다 — 개별 제거는 handleRemove에서 그때그때 푼다.
    ⚠️ pagesRef를 쓰는 이유: effect가 최신 pages를 봐야 하는데, 의존성에
    pages를 넣으면 목록이 바뀔 때마다 살아있는 URL을 해제해 미리보기가 깨진다.
  */
  const pagesRef = useRef<PendingPage[]>([]);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  useEffect(
    () => () => {
      for (const page of pagesRef.current) URL.revokeObjectURL(page.previewUrl);
    },
    [],
  );

  /**
   * 변환·전송 중 이탈 경고. 주보는 한 요청으로 끝나므로 사진 업로더보다
   * 위험이 작지만, 4장 변환 중에 닫으면 처음부터 다시 해야 한다.
   */
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const added = Array.from(fileList)
      // 이미지가 아닌 파일은 애초에 목록에 넣지 않는다 (변환 단계에서 실패한다)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: nextPageId(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
    setPages((prev) => [...prev, ...added]);
  }

  function handleRemove(id: string) {
    setPages((prev) => {
      const target = prev.find((page) => page.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((page) => page.id !== id);
    });
  }

  function handleMove(from: number, to: number) {
    setPages((prev) => move(prev, from, to));
  }

  /**
   * 업로드 (SPEC_API §5.4).
   *
   * ⚠️ **같은 날짜면 `DUPLICATE`가 온다.** §5.4는 "교체 여부를 FE가 확인 후
   * 재요청"이라고만 정했고 교체 엔드포인트가 없다. 그래서 확인을 받고
   * **삭제(§5.5) → 다시 업로드** 순으로 처리한다.
   *
   * 이 순서의 위험을 그대로 적어둔다: 삭제가 성공하고 재업로드가 실패하면
   * **기존 주보가 사라진 상태로 남는다.** 화면은 그 경우를 조용히 넘기지 않고
   * "기존 주보를 지웠지만 새로 올리지 못했다"고 말한다. 근본 해결은 서버가
   * 교체를 한 요청으로 처리하는 것이고, `BACKEND_HANDOFF`에 올렸다.
   */
  async function handleSubmit() {
    setError(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      setError("주일 날짜를 선택해주세요.");
      return;
    }
    if (pages.length === 0) {
      setError("주보 이미지를 1장 이상 선택해주세요.");
      return;
    }

    // ① 변환 — 2048px WebP (ARCHITECTURE §4.2). 순서를 유지해야 하므로 순차 처리한다
    const converted: Blob[] = [];
    setPhase({ kind: "converting", done: 0, total: pages.length });
    for (const [index, page] of pages.entries()) {
      try {
        const { blob } = await resizeToWebp(page.file, BULLETIN_MAX_EDGE);
        converted.push(blob);
      } catch (cause) {
        // 한 장이라도 변환에 실패하면 올리지 않는다 — 페이지가 빠진 주보는
        // 없는 것보다 나쁘다 (읽는 사람은 빠진 줄 모른다)
        setPhase({ kind: "idle" });
        setError(
          cause instanceof ResizeError
            ? `${page.file.name}: ${cause.message}`
            : `${page.file.name}을(를) 변환하지 못했습니다.`,
        );
        return;
      }
      setPhase({ kind: "converting", done: index + 1, total: pages.length });
    }

    // ② 전송
    setPhase({ kind: "uploading" });
    try {
      const result = await api.bulletins.create({ serviceDate, pages: converted });
      await finish(result.pageCount);
    } catch (cause) {
      if (isApiError(cause) && cause.code === "DUPLICATE") {
        await replaceExisting(converted);
        return;
      }
      setPhase({ kind: "idle" });
      setError(
        isApiError(cause) ? cause.message : "주보를 올리지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    }
  }

  /** DUPLICATE → 확인 → 기존 주보 삭제 → 재업로드 */
  async function replaceExisting(converted: Blob[]) {
    const ok = window.confirm(
      `${serviceDate} 주보가 이미 있습니다. 기존 주보를 지우고 새로 올릴까요?\n\n지운 주보는 되돌릴 수 없습니다.`,
    );
    if (!ok) {
      setPhase({ kind: "idle" });
      setError("같은 날짜의 주보가 이미 있습니다. 날짜를 바꾸거나 교체를 선택해주세요.");
      return;
    }

    try {
      // 교체 대상 id는 목록에서 날짜로 찾는다 — §5.4의 DUPLICATE 응답은 id를 주지 않는다
      const list = await api.bulletins.list({ size: 100 });
      const existing = list.items.find((item) => item.serviceDate === serviceDate);
      if (!existing) {
        setPhase({ kind: "idle" });
        setError("교체할 주보를 찾지 못했습니다. 목록을 확인한 뒤 다시 시도해주세요.");
        return;
      }

      await api.bulletins.remove(existing.id);
      const result = await api.bulletins.create({ serviceDate, pages: converted });
      await finish(result.pageCount);
    } catch (cause) {
      setPhase({ kind: "idle" });
      setError(
        isApiError(cause)
          ? `교체에 실패했습니다 — ${cause.message} 기존 주보가 이미 삭제됐을 수 있으니 주보 화면을 확인해주세요.`
          : "교체에 실패했습니다. 기존 주보가 이미 삭제됐을 수 있으니 주보 화면을 확인해주세요.",
      );
    }
  }

  async function finish(pageCount: number) {
    setPhase({ kind: "done", pageCount });
    for (const page of pages) URL.revokeObjectURL(page.previewUrl);
    setPages([]);
    // 최신 주보·목록·단건을 모두 다시 읽게 한다 (키가 전부 ["bulletins", ...])
    await queryClient.invalidateQueries({ queryKey: ["bulletins"] });
  }

  return (
    <Section>
      <Link
        href="/my/bulletin"
        className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--color-gray-400)] hover:underline"
      >
        ← 주보
      </Link>

      <h1 className="mt-2 text-xl font-bold md:text-2xl">주보 업로드</h1>

      <div className="mt-8 max-w-xl space-y-6">
        <div>
          <label htmlFor={dateId} className="mb-1 block text-sm font-bold">
            주일 날짜 *
          </label>
          <input
            id={dateId}
            type="date"
            className={inputClass}
            value={serviceDate}
            onChange={(event) => setServiceDate(event.target.value)}
          />
        </div>

        <div>
          <p className="mb-1 text-sm font-bold">이미지 *</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            // 아래 버튼이 이 input을 클릭한다 — 보이지 않는 탭 정지점을 만들지 않는다
            tabIndex={-1}
            onChange={(event) => {
              handleFiles(event.target.files);
              // 같은 파일을 다시 고를 수 있어야 한다 (value를 비우지 않으면 change가 안 뜬다)
              event.target.value = "";
            }}
          />
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            + 선택
          </Button>

          {pages.length > 0 && (
            <PageOrderList pages={pages} onMove={handleMove} onRemove={handleRemove} />
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[var(--radius-card)] border border-[var(--color-red-500)] p-4 text-sm text-[var(--color-red-500)]"
          >
            {error}
          </p>
        )}

        {phase.kind === "done" && (
          <div
            role="status"
            className="rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4 text-sm"
          >
            <p className="font-bold">주보를 올렸습니다 ({phase.pageCount}장).</p>
            <p className="mt-1">
              <Link href="/my/bulletin" className="underline">
                주보 화면에서 확인
              </Link>
              하거나, 다른 날짜의 주보를 이어서 올릴 수 있습니다.
            </p>
          </div>
        )}

        <div>
          <Button
            type="button"
            disabled={busy || pages.length === 0 || serviceDate === ""}
            onClick={() => void handleSubmit()}
          >
            {phase.kind === "converting"
              ? `변환 중 ${phase.done}/${phase.total}...`
              : phase.kind === "uploading"
                ? "올리는 중..."
                : "업로드"}
          </Button>

          {/* WIREFRAME §17의 안내 문구. 교체는 되돌릴 수 없으므로 미리 알린다 */}
          <p className="mt-3 text-sm text-[var(--color-gray-400)]">
            같은 날짜의 주보가 이미 있으면 교체할지 물어봅니다. 이미지는 장변
            2048px으로 변환해 올립니다.
          </p>
        </div>
      </div>
    </Section>
  );
}
