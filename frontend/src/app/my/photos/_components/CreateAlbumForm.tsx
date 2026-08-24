"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import type { AlbumInput } from "@/types/api";
import { ALBUMS_QUERY_KEY } from "./AlbumList";

/** SPEC_API §6.2 — `{ title, eventDate }` */
const schema = z.object({
  title: z.string().trim().min(1, "앨범 제목을 입력해주세요.").max(100),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "행사일을 선택해주세요."),
});

type FormValues = z.infer<typeof schema>;

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base outline-none focus:border-[var(--color-yellow)]";

/**
 * 앨범 생성 (SPEC_API §6.2, 권한 `L`).
 *
 * 호출부에서 `LEADER`/`PASTOR`에게만 렌더한다 — 다만 이건 UI 편의일 뿐이고
 * 실제 인가는 서버가 한다 (`RequireMember`와 같은 원칙, WORKPLAN §5.1).
 * 그래서 여기서도 서버가 돌려주는 `FORBIDDEN`을 정상 경로로 처리한다.
 */
export function CreateAlbumForm() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", eventDate: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: AlbumInput) => api.albums.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ALBUMS_QUERY_KEY });
      reset();
      setOpen(false);
    },
    onError: (error) => {
      // VALIDATION_ERROR는 field(예: `title`)를 주므로 해당 입력에 붙인다
      if (isApiError(error) && error.field) {
        setError(error.field as keyof FormValues, { message: error.message });
        return;
      }
      setError("root", {
        message: isApiError(error)
          ? error.message
          : "앨범을 만들지 못했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        앨범 만들기
      </Button>
    );
  }

  return (
    <form
      className="max-w-sm space-y-4 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-5"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <div>
        <label htmlFor="album-title" className="mb-1 block text-sm font-bold">
          제목 *
        </label>
        <input
          id="album-title"
          className={inputClass}
          placeholder="2026 여름 수련회"
          {...register("title")}
        />
        {errors.title && (
          <p className="mt-1 text-sm text-[var(--color-red-500)]">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="album-event-date" className="mb-1 block text-sm font-bold">
          행사일 *
        </label>
        <input
          id="album-event-date"
          type="date"
          className={inputClass}
          {...register("eventDate")}
        />
        {errors.eventDate && (
          <p className="mt-1 text-sm text-[var(--color-red-500)]">{errors.eventDate.message}</p>
        )}
      </div>

      {errors.root && (
        <p className="text-sm text-[var(--color-red-500)]">{errors.root.message}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "만드는 중..." : "만들기"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={mutation.isPending}
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          취소
        </Button>
      </div>
    </form>
  );
}
