"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { passwordField } from "@/lib/password";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/** SPEC_API §2.12 */
const schema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요."),
    newPassword: passwordField("새 비밀번호"),
    newPasswordConfirm: z.string().min(1, "새 비밀번호 확인을 입력해주세요."),
  })
  .refine((values) => values.newPassword === values.newPasswordConfirm, {
    message: "새 비밀번호가 일치하지 않습니다.",
    path: ["newPasswordConfirm"],
  });

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { currentPassword: "", newPassword: "", newPasswordConfirm: "" };

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

/** WIREFRAME.md §14 — ▸ 비밀번호 변경 */
export function PasswordChangeForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.auth.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      setDone(true);
      reset();
    },
    onError: (error) => {
      /*
        실패하면 세 칸을 **모두 비운다** (PM 요청 2026-10-07). 어느 칸이 틀렸는지
        눈으로 확인할 수 없는 비밀번호 칸에 값이 남아 있으면, 사용자는 일부만
        고치다 다시 틀린다. 처음부터 다시 치게 한다. `reset`이 오류도 지우므로
        오류는 비운 **다음에** 건다.
      */
      reset(EMPTY);

      /*
        ⚠️ 서버는 현재 비밀번호가 틀리면 `field: "password"`로 준다
        (`ProfileService.assertPasswordMatches`). 폼 칸 이름은 `currentPassword`라
        그대로 `setError("password")`에 넘기면 아무 데도 그려지지 않았다 — 버튼만
        다시 눌리고 문구가 없었다 (사용자 흐름 점검 2026-10-07 🔴-1).
        새 비밀번호 길이(72바이트)는 폼이 먼저 막으므로 이 경로의 `password`는
        현재 비밀번호 불일치뿐이다.
      */
      if (isApiError(error) && (error.field === "password" || error.field === "currentPassword")) {
        setError("currentPassword", {
          message: "현재 비밀번호가 올바르지 않습니다. 처음부터 다시 입력해주세요.",
        });
        // `reset` 직후에는 칸이 다시 그려지는 중이라 바로 포커스가 들어가지 않는다 — 한 틱 뒤에
        window.setTimeout(() => setFocus("currentPassword"), 0);
        return;
      }
      if (isApiError(error) && (error.field === "newPassword" || error.field === "newPasswordConfirm")) {
        setError(error.field, { message: error.message });
        return;
      }
      // 그려질 칸이 없는 field는 전부 폼 상단으로 — 조용히 사라지지 않게 한다
      setError("root", {
        message: isApiError(error) ? error.message : "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  if (!isOpen) {
    return (
      <button
        type="button"
        className="inline-flex min-h-11 items-center text-base font-bold text-[var(--color-ink)] hover:underline"
        onClick={() => {
          setIsOpen(true);
          setDone(false);
        }}
      >
        ▸ 비밀번호 변경
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="mb-3 inline-flex min-h-11 items-center text-base font-bold text-[var(--color-ink)] hover:underline"
        onClick={() => setIsOpen(false)}
      >
        ▾ 비밀번호 변경
      </button>

      {done ? (
        <p className="text-sm font-bold text-[var(--color-navy-800)]">
          비밀번호가 변경되었습니다.
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <div>
            <label htmlFor="currentPassword" className="mb-1 block text-sm font-bold">
              현재 비밀번호
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              className={inputClass}
              {...register("currentPassword")}
            />
            {errors.currentPassword && (
              <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm font-bold">
              새 비밀번호
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              {...register("newPassword")}
            />
            {errors.newPassword && (
              <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="newPasswordConfirm" className="mb-1 block text-sm font-bold">
              새 비밀번호 확인
            </label>
            <input
              id="newPasswordConfirm"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              {...register("newPasswordConfirm")}
            />
            {errors.newPasswordConfirm && (
              <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">
                {errors.newPasswordConfirm.message}
              </p>
            )}
          </div>

          {errors.root && (
            <p role="alert" className="text-sm text-[var(--color-red-500)]">{errors.root.message}</p>
          )}

          <Button type="submit" variant="secondary" disabled={mutation.isPending}>
            {mutation.isPending ? "변경 중..." : "비밀번호 변경"}
          </Button>
        </form>
      )}
    </div>
  );
}
