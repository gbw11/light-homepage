"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/** SPEC_API §6.10 — `POST /api/photos/{id}/report`, 요청 필드는 `reason` 하나뿐 */
const schema = z.object({
  reason: z.string().trim().min(1, "요청 내용을 입력해주세요.").max(1000),
});

type FormValues = z.infer<typeof schema>;

/**
 * 사진 신고 · 내려달라 요청 (WIREFRAME §13-4 `⋮`, SPEC_API §6.10).
 *
 * 초상권 대응 창구다 — "임원에게 전달된다"는 것을 문구로 분명히 밝힌다
 * (요청이 어디로 가는지 모르면 이 기능은 쓰이지 않는다).
 *
 * 라이트박스 안에 겹쳐 뜨므로 이 패널 안의 키 입력은 바깥으로 흘리지 않는다
 * (←/→가 사진을 넘겨버리거나 Esc가 라이트박스까지 닫는 것을 막는다).
 */
export function PhotoReportForm({
  photoId,
  onClose,
}: {
  photoId: string;
  onClose: () => void;
}) {
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "" },
  });

  const { ref: reasonRef, ...reasonField } = register("reason");

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.photos.report(photoId, { reason: values.reason }),
    onSuccess: () => setDone(true),
    onError: (error) => {
      // VALIDATION_ERROR는 `field: "reason"`으로 온다 (SPEC_API §1.4)
      if (isApiError(error) && error.field === "reason") {
        setError("reason", { message: error.message });
        return;
      }
      setError("root", {
        message: isApiError(error)
          ? error.message
          : "요청을 보내지 못했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 신고 · 삭제 요청"
      className="absolute inset-x-0 bottom-0 z-20 max-h-full overflow-y-auto rounded-t-[var(--radius-card)] bg-[var(--background)] p-5"
      onKeyDown={(e) => {
        // 라이트박스의 전역 키 핸들러(←/→ 이동, Esc 닫기)로 새지 않게 막는다
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      {done ? (
        <div>
          <p className="text-lg font-bold">요청이 전달됐습니다</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-gray-400)]">
            임원이 확인한 뒤 처리 결과를 알려드립니다.
          </p>
          <Button type="button" className="mt-5 w-full" onClick={onClose}>
            닫기
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <p className="text-lg font-bold">사진 신고 · 삭제 요청</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-gray-400)]">
            이 사진에 대한 요청을 <strong className="font-bold">임원</strong>에게 보냅니다.
            본인이 찍힌 사진을 내려달라는 요청도 여기로 보내주세요.
          </p>

          <label htmlFor="reason" className="mt-4 mb-1 block text-sm font-bold">
            요청 내용 *
          </label>
          <textarea
            id="reason"
            rows={3}
            placeholder="예) 본인 사진 삭제 요청합니다"
            className="w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent p-3 text-base outline-none focus:border-[var(--color-yellow)]"
            {...reasonField}
            ref={(node) => {
              reasonRef(node);
              textareaRef.current = node;
            }}
          />
          {errors.reason && (
            <p className="mt-1 text-sm text-[var(--color-red-500)]">{errors.reason.message}</p>
          )}
          {errors.root && (
            <p className="mt-1 text-sm text-[var(--color-red-500)]">{errors.root.message}</p>
          )}

          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              취소
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "보내는 중..." : "요청 보내기"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
