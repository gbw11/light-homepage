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
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", newPasswordConfirm: "" },
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
      if (isApiError(error) && error.field) {
        setError(error.field as keyof FormValues, { message: error.message });
        return;
      }
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
