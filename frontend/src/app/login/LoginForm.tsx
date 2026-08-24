"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { LoginInput } from "@/types/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";

/** WIREFRAME.md §10-1, SPEC_API.md §2.2 */
const schema = z.object({
  email: z.string().trim().min(1, "이메일을 입력해주세요.").email("이메일 형식이 아닙니다."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

type FormValues = z.infer<typeof schema>;

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

export function LoginForm() {
  const router = useRouter();
  const { refetch } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onSuccess: () => {
      // 세션이 생겼으니 전역 로그인 상태를 갱신하고 회원 홈으로
      refetch();
      router.push("/my");
    },
    onError: (error) => {
      if (isApiError(error) && error.code === "PENDING_APPROVAL") {
        // 로그인 자체는 성공(세션 생성)했지만 승인 전 — SPEC_API §2.2
        refetch();
        router.push("/pending");
        return;
      }
      if (isApiError(error) && error.code === "UNAUTHORIZED") {
        setError("root", { message: "이메일 또는 비밀번호가 올바르지 않습니다." });
        return;
      }
      setError("root", {
        message: isApiError(error) ? error.message : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  return (
    <div className="mx-auto w-full max-w-sm">
      <a
        href="/api/auth/kakao/authorize"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[#FEE500] px-6 text-base font-bold text-[#191919] transition hover:brightness-95"
      >
        💬 카카오로 3초 만에 시작
      </a>

      <div className="my-6 flex items-center gap-3 text-sm text-[var(--color-gray-400)]">
        <hr className="flex-1 border-[var(--color-navy-100)]" />
        또는
        <hr className="flex-1 border-[var(--color-navy-100)]" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
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

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-bold">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            {...register("password")}
          />
          {errors.password && (
            <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">{errors.password.message}</p>
          )}
        </div>

        {errors.root && (
          <p role="alert" className="text-sm text-[var(--color-red-500)]">{errors.root.message}</p>
        )}

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "로그인 중..." : "로그인"}
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-sm">
        <Link href="/password/reset-request" className="flex min-h-11 items-center text-[var(--color-gray-400)]">
          ▸ 비밀번호를 잊으셨나요?
        </Link>
        <Link href="/signup" className="flex min-h-11 items-center font-bold">
          ▸ 처음이신가요? 회원가입
        </Link>
        <Link href="/welcome" className="flex min-h-11 items-center text-[var(--color-gray-400)]">
          ▸ 처음 오시는 분이신가요?
        </Link>
      </div>
    </div>
  );
}
