"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { PageOrderList } from "./PageOrderList";
import { move, nextPageId, type PendingPage } from "./pages";

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dateId = useId();

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
      </div>
    </Section>
  );
}
