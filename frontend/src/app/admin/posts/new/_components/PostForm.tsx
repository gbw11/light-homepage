"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import {
  EMPTY_POST_BODY,
  PostEditor,
  isPostBodyEmpty,
} from "@/components/post/PostEditor";
import { PostBodyView } from "@/components/post/PostBodyView";
import type { PostBody, PostCategory, PostInput } from "@/types/api";

/**
 * WIREFRAME.md §16 · SPEC_API §3.4 — 글 작성 폼 (FR-DOC-01).
 *
 * 상태를 셋으로 나눈 이유:
 *   · 분류·제목·상단고정 → react-hook-form + zod (CONVENTIONS.md §4)
 *   · 본문 → Tiptap이 들고 있고 `onChange`로 받아 `useState`에 둔다.
 *     ProseMirror 문서를 RHF 필드로 등록해봤자 검증할 게 "비었나" 하나뿐이다
 *   · 첨부 → 파일별 업로드 진행/실패 상태가 있어 폼 값이 아니라 목록 상태다
 */

const CATEGORIES: { value: PostCategory; label: string; audience: string; isPublic: boolean }[] = [
  { value: "NOTICE_PUBLIC", label: "공지(공개)", audience: "누구나", isPublic: true },
  { value: "NOTICE_MEMBER", label: "공지(내부)", audience: "회원", isPublic: false },
  { value: "MINUTES", label: "회의록", audience: "임원 이상", isPublic: false },
  { value: "BUDGET", label: "예산안", audience: "임원 이상", isPublic: false },
];

const schema = z.object({
  category: z.enum(["NOTICE_PUBLIC", "NOTICE_MEMBER", "MINUTES", "BUDGET"]),
  title: z.string().trim().min(1, "제목을 입력해주세요.").max(200, "제목이 너무 깁니다."),
  pinned: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/** 업로드 중인/끝난 첨부 하나 */
type AttachmentItem = {
  /** 화면상의 키. 업로드 성공 후에도 바뀌지 않는다 */
  key: string;
  filename: string;
  sizeBytes: number;
  status: "uploading" | "done" | "error";
  /** 서버가 준 id — `attachmentIds`로 보낼 값. 성공 전에는 null */
  id: string | null;
  error?: string;
};

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base outline-none focus:border-[var(--color-yellow)]";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)}KB` : `${(kb / 1024).toFixed(1)}MB`;
}

export function PostForm() {
  const [body, setBody] = useState<PostBody>(EMPTY_POST_BODY);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [saved, setSaved] = useState<{ id: string; published: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: "NOTICE_PUBLIC", title: "", pinned: false },
  });

  const category = useWatch({ control, name: "category" });
  const selected = CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[0];

  const uploading = attachments.some((a) => a.status === "uploading");
  const failed = attachments.filter((a) => a.status === "error");

  const save = useMutation({
    mutationFn: ({ publish, values }: { publish: boolean; values: FormValues }) => {
      const input: PostInput = {
        category: values.category,
        title: values.title.trim(),
        body,
        pinned: values.pinned,
        // 업로드에 성공한 것만 연결한다. 실패한 파일은 id가 없다
        attachmentIds: attachments.filter((a) => a.id).map((a) => a.id as string),
        publish,
      };
      return api.posts.create(input).then((r) => ({ ...r, published: publish }));
    },
    onSuccess: ({ id, published }) => setSaved({ id, published }),
    onError: (error) => {
      if (isApiError(error) && error.field === "body") {
        setBodyError(error.message);
        return;
      }
      if (isApiError(error) && error.field) {
        setError(error.field as keyof FormValues, { message: error.message });
        return;
      }
      setError("root", {
        message: isApiError(error)
          ? error.message
          : "저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  function submit(publish: boolean) {
    return handleSubmit((values) => {
      if (isPostBodyEmpty(body)) {
        setBodyError("본문을 입력해주세요.");
        return;
      }
      setBodyError(null);
      save.mutate({ publish, values });
    });
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      setAttachments((prev) => [
        ...prev,
        { key, filename: file.name, sizeBytes: file.size, status: "uploading", id: null },
      ]);

      try {
        const result = await api.attachments.upload(file);
        setAttachments((prev) =>
          prev.map((a) =>
            a.key === key
              ? { ...a, status: "done", id: result.id, sizeBytes: result.sizeBytes }
              : a,
          ),
        );
      } catch (error) {
        setAttachments((prev) =>
          prev.map((a) =>
            a.key === key
              ? {
                  ...a,
                  status: "error",
                  error: isApiError(error) ? error.message : "업로드에 실패했습니다.",
                }
              : a,
          ),
        );
      }
    }
  }

  // ── 저장 완료 ────────────────────────────────────────────
  if (saved) {
    return (
      <div>
        <p className="text-xl font-bold">
          {saved.published ? "게시했습니다 🎉" : "임시저장했습니다"}
        </p>
        <p className="mt-2 text-sm text-[var(--color-gray-400)]">
          {saved.published
            ? `${selected.label} · 공개 범위: ${selected.audience}`
            : "아직 공개되지 않았습니다 (게시일 없음)."}
        </p>

        {/*
          ★ 저장된 본문을 **읽기 화면과 같은 컴포넌트**(PostBodyView)로 다시
            보여준다. 에디터가 만든 것과 사이트가 보여줄 수 있는 것이 어긋나면
            여기서 바로 드러난다 — 작성자가 "쓴 게 사라졌다"를 저장 직후에
            알 수 있어야 한다.
        */}
        <div className="mt-8 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-5">
          <p className="text-sm font-bold text-[var(--color-gray-400)]">저장된 내용</p>
          <PostBodyView body={body} className="mt-4" />
          {attachments.filter((a) => a.id).length > 0 && (
            <ul className="mt-6 space-y-1 border-t border-[var(--color-navy-100)] pt-4 text-sm text-[var(--color-gray-400)]">
              {attachments
                .filter((a) => a.id)
                .map((a) => (
                  <li key={a.key}>📎 {a.filename}</li>
                ))}
            </ul>
          )}
        </div>

        <div className="mt-8 flex gap-3">
          <Link
            href="/my"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
          >
            나의 LIGHT로
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setSaved(null);
              setAttachments([]);
              setBody(EMPTY_POST_BODY);
              // 제목·분류·상단고정도 비운다 (에디터는 리마운트되며 저절로 빈다)
              reset({ category: "NOTICE_PUBLIC", title: "", pinned: false });
            }}
          >
            새 글 쓰기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-8" onSubmit={submit(true)}>
      {/* ── 분류 ─────────────────────────────────────────── */}
      <div>
        <label htmlFor="category" className="text-sm font-bold">
          분류
        </label>
        {/*
          FR-DOC-06 — **분류 선택이 곧 공개 범위 결정이다.** 이름만으로는 누가
          볼 수 있는지 알 수 없으므로 각 항목에 대상까지 함께 적는다.
        */}
        <select id="category" className={`${inputClass} mt-2`} {...register("category")}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label} — {c.audience}
            </option>
          ))}
        </select>

        {selected.isPublic ? (
          <p
            // 경고는 스크린리더에도 즉시 전달돼야 한다 (분류를 바꾸는 순간 바뀌는 정보)
            role="status"
            /*
              와이어프레임 §16은 "경고색(옐로우)"이라고 적었지만, 팔레트 개편으로
              `--color-yellow`는 초록(주요 CTA)이 됐다 — 그 색으로는 경고로 읽히지
              않는다. 남은 경고 토큰인 `--color-red-500`을 쓴다.
            */
            className="mt-2 rounded-[var(--radius-card)] border border-[var(--color-red-500)] bg-[var(--color-red-500)]/10 px-4 py-3 text-sm font-bold"
          >
            ⚠️ 공개 공지는 로그인 없이 누구나 볼 수 있습니다.
          </p>
        ) : (
          <p role="status" className="mt-2 text-sm text-[var(--color-gray-400)]">
            🔒 {selected.audience}만 볼 수 있습니다.
          </p>
        )}
      </div>

      {/* ── 제목 ─────────────────────────────────────────── */}
      <div>
        <label htmlFor="title" className="text-sm font-bold">
          제목
        </label>
        <input
          id="title"
          type="text"
          className={`${inputClass} mt-2`}
          aria-invalid={errors.title ? true : undefined}
          {...register("title")}
        />
        {errors.title && (
          <p className="mt-1 text-sm text-[var(--color-red-500)]">{errors.title.message}</p>
        )}
      </div>

      {/* ── 본문 ─────────────────────────────────────────── */}
      <div>
        <p className="text-sm font-bold" id="body-label">
          본문
        </p>
        <div className="mt-2" aria-labelledby="body-label">
          <PostEditor
            value={EMPTY_POST_BODY}
            onChange={(next) => {
              setBody(next);
              if (bodyError) setBodyError(null);
            }}
            disabled={save.isPending}
          />
        </div>
        {bodyError && (
          <p className="mt-1 text-sm text-[var(--color-red-500)]">{bodyError}</p>
        )}
      </div>

      {/* ── 첨부파일 ─────────────────────────────────────── */}
      <div>
        <p className="text-sm font-bold">첨부파일</p>
        <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold text-[var(--color-navy-900)] transition hover:brightness-95">
          + 파일 선택
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              void upload(e.target.files);
              // 같은 파일을 다시 고를 수 있게 초기화한다
              e.target.value = "";
            }}
          />
        </label>

        {attachments.length > 0 && (
          // 업로드 진행·실패가 스크린리더에도 전달돼야 한다
          <ul className="mt-3 space-y-2" aria-live="polite">
            {attachments.map((a) => (
              <li
                key={a.key}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] px-4 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {a.status === "error" ? "⚠️" : a.status === "uploading" ? "⏳" : "📎"} {a.filename}
                </span>
                <span
                  className={
                    a.status === "error"
                      ? "text-[var(--color-red-500)]"
                      : "text-[var(--color-gray-400)]"
                  }
                >
                  {a.status === "uploading"
                    ? "올리는 중…"
                    : a.status === "error"
                      ? (a.error ?? "실패")
                      : formatSize(a.sizeBytes)}
                </span>
                <button
                  type="button"
                  aria-label={`${a.filename} 제거`}
                  className="rounded-md px-2 py-1 text-[var(--color-gray-400)] hover:bg-[var(--color-navy-100)]"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((x) => x.key !== a.key))
                  }
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {failed.length > 0 && (
          <p className="mt-2 text-sm text-[var(--color-gray-400)]">
            실패한 {failed.length}개는 연결되지 않습니다. 저장은 가능하고, 서버에 남은
            미연결 파일은 24시간 후 정리됩니다 (SPEC_API §4.1).
          </p>
        )}
      </div>

      {/* ── 상단 고정 ────────────────────────────────────── */}
      <div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="size-4" {...register("pinned")} />
          상단 고정
        </label>
      </div>

      {errors.root && (
        <p role="alert" className="text-sm text-[var(--color-red-500)]">
          {errors.root.message}
        </p>
      )}

      {/* ── 저장 ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {/*
          임시저장은 `publish: false` — `publishedAt`이 null로 남는다 (SPEC_API §3.4).
          같은 엔드포인트·같은 본문이고 이 플래그만 다르다.
        */}
        <Button
          type="button"
          variant="secondary"
          disabled={save.isPending || uploading}
          onClick={submit(false)}
        >
          {save.isPending ? "저장 중…" : "임시저장"}
        </Button>
        <Button type="submit" disabled={save.isPending || uploading}>
          {save.isPending ? "저장 중…" : "게시하기"}
        </Button>
        {uploading && (
          <p className="self-center text-sm text-[var(--color-gray-400)]">
            첨부 업로드가 끝나면 저장할 수 있습니다.
          </p>
        )}
      </div>
    </form>
  );
}
