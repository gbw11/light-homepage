"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/** SPEC_API.md §2.9 — 계정 존재 여부를 노출하지 않기 위해 항상 성공 메시지를 보여준다 */
const schema = z.object({
  email: z.string().trim().min(1, "이메일을 입력해주세요.").email("이메일 형식이 아닙니다."),
});

type FormValues = z.infer<typeof schema>;

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

export function ResetRequestForm() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: { email: string }) => api.auth.passwordResetRequest(input),
    onSuccess: () => setSubmitted(true),
    onError: (error) => {
      // SPEC_API §2.9: 항상 204 — 여기 도달하면 네트워크/서버 오류 등 폼과 무관한 문제다.
      setError("root", {
        message: isApiError(error) ? error.message : "요청에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  if (submitted) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <p className="text-xl font-bold">메일을 보냈습니다</p>
        <p className="mt-2 leading-relaxed text-[var(--color-gray-400)]">
          입력하신 이메일이 가입된 계정이라면, 비밀번호 재설정 링크를
          보내드렸습니다. 메일함을 확인해주세요.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-navy-900)] transition hover:brightness-95"
        >
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <form
      className="mx-auto max-w-sm space-y-5"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <p className="text-sm text-[var(--color-gray-400)]">
        가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를
        보내드립니다.
      </p>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-bold">
          이메일
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className={inputClass}
          {...register("email")}
        />
        {errors.email && (
          <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">{errors.email.message}</p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-sm text-[var(--color-red-500)]">{errors.root.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "전송 중..." : "재설정 링크 보내기"}
      </Button>

      <Link href="/login" className="block text-center text-sm text-[var(--color-gray-400)]">
        ▸ 로그인으로 돌아가기
      </Link>
    </form>
  );
}
