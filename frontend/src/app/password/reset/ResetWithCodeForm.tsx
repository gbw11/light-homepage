"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { passwordField } from "@/lib/password";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/**
 * WIREFRAME.md §10-4 — 리셋 코드 방식 비밀번호 재설정 (SPEC_API §2.9 v1.3).
 *
 * 코드는 전도사가 발급해(§8.4) 구두/문자로 전달한다 — 이메일 링크 방식은
 * 폐기됐다(이메일을 수집하지 않음). 코드 불일치·만료는 서버가 UNAUTHORIZED
 * 단일 응답을 주므로 폼 전체 단일 문구로 처리한다 (필드 오류로 붙이지 않는다).
 */

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

const schema = z
  .object({
    loginId: z.string().trim().min(1, "아이디를 입력해주세요."),
    resetCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/, "코드를 XXXX-XXXX 형식으로 입력해주세요."),
    password: passwordField(),
    passwordConfirm: z.string().min(1, "비밀번호를 한 번 더 입력해주세요."),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

type FormValues = z.infer<typeof schema>;

export function ResetWithCodeForm() {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { loginId: "", resetCode: "", password: "", passwordConfirm: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.auth.resetPasswordWithCode({
        loginId: values.loginId,
        resetCode: values.resetCode,
        password: values.password,
      }),
    onSuccess: () => setDone(true),
    onError: (error) => {
      if (isApiError(error) && error.code === "UNAUTHORIZED") {
        // 코드 불일치·만료 — 어느 쪽인지 알려주지 않는 단일 응답 (SPEC_API §2.9)
        setError("root", { message: "코드가 올바르지 않거나 만료되었습니다." });
        return;
      }
      setError("root", {
        message: isApiError(error)
          ? error.message
          : "재설정에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  if (done) {
    return (
      <div className="mx-auto w-full max-w-sm text-center">
        <p className="text-4xl">✅</p>
        <h2 className="mt-4 text-xl font-bold">비밀번호가 변경되었습니다</h2>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)]"
        >
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <p className="leading-relaxed text-[var(--color-gray-400)]">
        전도사님께 문의하시면 재설정 코드를 받을 수 있습니다. 코드는 30분간
        유효합니다.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <div>
          <label htmlFor="loginId" className="mb-1 block text-sm font-bold">
            아이디
          </label>
          <input
            id="loginId"
            type="text"
            autoComplete="username"
            className={inputClass}
            {...register("loginId")}
          />
          {errors.loginId && (
            <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">{errors.loginId.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="resetCode" className="mb-1 block text-sm font-bold">
            재설정 코드
          </label>
          <input
            id="resetCode"
            type="text"
            placeholder="XXXX-XXXX"
            autoComplete="one-time-code"
            className={inputClass}
            {...register("resetCode")}
          />
          {errors.resetCode && (
            <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">{errors.resetCode.message}</p>
          )}
        </div>

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
          <p className="mt-1 text-xs text-[var(--color-gray-400)]">8자 이상</p>
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
          <p role="alert" className="text-sm font-bold text-[var(--color-red-500)]">
            ⚠ {errors.root.message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "변경 중..." : "변경하기"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-[var(--color-gray-400)]">
        ⓘ 카카오로 가입하셨다면 비밀번호 없이 카카오 로그인을 이용하세요.
      </p>
      <div className="mt-2 text-sm">
        <Link href="/login" className="flex min-h-11 items-center text-[var(--color-gray-400)]">
          ▸ 로그인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
