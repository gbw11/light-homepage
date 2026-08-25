"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/** SPEC_API.md §2.10 */
const schema = z
  .object({
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
    passwordConfirm: z.string().min(1, "비밀번호 확인을 입력해주세요."),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

type FormValues = z.infer<typeof schema>;

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

export function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [submitted, setSubmitted] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", passwordConfirm: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.auth.passwordResetConfirm({ token, password: values.password }),
    onSuccess: () => setSubmitted(true),
    onError: (error) => {
      if (isApiError(error) && error.code === "VALIDATION_ERROR" && error.field === "token") {
        // 토큰 자체가 만료/무효 — 폼 필드가 아니라 화면 전체 안내로 보여준다.
        setTokenError(error.message);
        return;
      }
      if (isApiError(error) && error.field) {
        setError(error.field as keyof FormValues, { message: error.message });
        return;
      }
      setError("root", {
        message: isApiError(error)
          ? error.message
          : "비밀번호 재설정에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  if (!token) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <p className="text-xl font-bold">잘못된 접근입니다</p>
        <p className="mt-2 leading-relaxed text-[var(--color-gray-400)]">
          비밀번호 재설정 링크가 올바르지 않습니다. 메일함에서 받은 링크를
          다시 확인해주세요.
        </p>
        <Link
          href="/password/reset-request"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
        >
          재설정 메일 다시 받기
        </Link>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <p className="text-xl font-bold">링크가 만료되었습니다</p>
        <p className="mt-2 leading-relaxed text-[var(--color-gray-400)]">{tokenError}</p>
        <Link
          href="/password/reset-request"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
        >
          재설정 메일 다시 받기
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <p className="text-xl font-bold">비밀번호가 변경되었습니다</p>
        <p className="mt-2 leading-relaxed text-[var(--color-gray-400)]">
          새 비밀번호로 다시 로그인해주세요.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  return (
    <form
      className="mx-auto max-w-sm space-y-5"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-bold">
          새 비밀번호
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          {...register("password")}
        />
        {errors.password && (
          <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">{errors.password.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="passwordConfirm" className="mb-1 block text-sm font-bold">
          새 비밀번호 확인
        </label>
        <input
          id="passwordConfirm"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          {...register("passwordConfirm")}
        />
        {errors.passwordConfirm && (
          <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">
            {errors.passwordConfirm.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-sm text-[var(--color-red-500)]">{errors.root.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "변경 중..." : "비밀번호 변경"}
      </Button>
    </form>
  );
}
