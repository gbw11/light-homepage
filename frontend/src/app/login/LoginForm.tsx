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

/** WIREFRAME.md §10-1, SPEC_API.md §2.3 — loginId 기반 (v1.3) */
const schema = z.object({
  loginId: z.string().trim().min(1, "아이디를 입력해주세요."),
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
    defaultValues: { loginId: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onSuccess: () => {
      // 세션이 생겼으니 전역 로그인 상태를 갱신하고 회원 홈으로
      refetch();
      router.push("/my");
    },
    onError: (error) => {
      if (isApiError(error) && error.code === "UNAUTHORIZED") {
        // 5회 실패 잠금도 서버가 같은 응답을 주므로(SPEC_API §2.3) 문구는 이것 하나다
        setError("root", { message: "아이디 또는 비밀번호가 올바르지 않습니다." });
        return;
      }
      setError("root", {
        message: isApiError(error) ? error.message : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  return (
    <div className="mx-auto w-full max-w-sm">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
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

      <div className="my-6 flex items-center gap-3 text-sm text-[var(--color-gray-400)]">
        <hr className="flex-1 border-[var(--color-navy-100)]" />
        또는
        <hr className="flex-1 border-[var(--color-navy-100)]" />
      </div>

      {/*
        카카오는 **카카오로 가입한 회원의 로그인 수단**이다. ~~"3초 만에 시작"~~ 은
        폐기 — 카카오만으로는 가입할 수 없다(명단 대조 필수, SPEC_API §2.7).
      */}
      <a
        href="/api/auth/kakao/authorize"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[#FEE500] px-6 text-base font-bold text-[#191919] transition hover:brightness-95"
      >
        💬 카카오로 로그인
      </a>

      <div className="mt-6 space-y-2 text-sm">
        <Link href="/password/reset" className="flex min-h-11 items-center text-[var(--color-gray-400)]">
          ▸ 비밀번호를 잊으셨나요?
        </Link>
        {/*
          회원가입 진입점 복구 (2026-08-31) — 내부공지·회의록·사진첩·월례회가
          다시 회원 전용이 되어(SPEC_API §3.1 v1.3) 일반 회원 계정에 의미가
          생겼다. 가입은 명단 대조 2단계다 (WIREFRAME §10-2).
        */}
        <Link href="/signup" className="flex min-h-11 items-center text-[var(--color-gray-400)]">
          ▸ 처음이신가요? 회원가입
        </Link>
        <Link href="/welcome" className="flex min-h-11 items-center text-[var(--color-gray-400)]">
          ▸ 처음 오시는 분이신가요?
        </Link>
      </div>
    </div>
  );
}
