"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { VerifyRosterResult } from "@/types/api";
import { Button } from "@/components/ui/Button";

/**
 * WIREFRAME.md §10-2 — 명단 확인 2단계 가입 (SPEC_API §2.1~2.2 v1.3).
 *
 * 1단계: 이름(동명이인 접미사 포함)+생년월일+전화번호를 명단과 대조
 *   ⚠️ 실패는 폼 전체 단일 문구다 — 어느 필드가 틀렸는지 표시하지 않는다
 *     (명단 정보 탐색 방지). 동명이인 2건 이상(VALIDATION_ERROR)만 별도 안내.
 * 2단계: registrationToken(5분·1회용)으로 아이디+비밀번호 또는 카카오
 *   → 생성 즉시 MEMBER (승인 없음).
 */

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

const verifySchema = z.object({
  name: z.string().trim().min(2, "이름을 입력해주세요."),
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "생년월일을 YYYY-MM-DD 형식으로 입력해주세요."),
  phone: z
    .string()
    .trim()
    .regex(/^010-\d{4}-\d{4}$/, "전화번호를 010-0000-0000 형식으로 입력해주세요."),
});

type VerifyValues = z.infer<typeof verifySchema>;

/**
 * loginId 형식은 계약에 미확정이라 FE가 보수적으로 잡았다
 * (영문 소문자·숫자 4~20자 — BACKEND_HANDOFF.md 2026-08-31 제안).
 */
const registerSchema = z
  .object({
    loginId: z
      .string()
      .trim()
      .regex(/^[a-z0-9]{4,20}$/, "아이디는 영문 소문자·숫자 4~20자입니다."),
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
    passwordConfirm: z.string().min(1, "비밀번호를 한 번 더 입력해주세요."),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

type Step =
  | { kind: "verify" }
  | { kind: "register"; verified: VerifyRosterResult; input: VerifyValues }
  | { kind: "expired" }
  | { kind: "done"; name: string };

export function SignupFlow() {
  const [step, setStep] = useState<Step>({ kind: "verify" });

  switch (step.kind) {
    case "verify":
      return (
        <VerifyStep
          onVerified={(verified, input) => setStep({ kind: "register", verified, input })}
        />
      );
    case "register":
      return (
        <RegisterStep
          verified={step.verified}
          verifyInput={step.input}
          onExpired={() => setStep({ kind: "expired" })}
          onDone={(name) => setStep({ kind: "done", name })}
        />
      );
    case "expired":
      return (
        <div className="mx-auto w-full max-w-sm text-center">
          <p className="text-4xl">⌛</p>
          <h2 className="mt-4 text-xl font-bold">시간이 지났습니다</h2>
          <p className="mt-2 text-[var(--color-gray-400)]">
            본인 확인은 5분 안에 완료해야 합니다. 처음부터 다시 진행해주세요.
          </p>
          <Button type="button" className="mt-6 w-full" onClick={() => location.reload()}>
            처음부터 다시
          </Button>
        </div>
      );
    case "done":
      return (
        <div className="mx-auto w-full max-w-sm text-center">
          <p className="text-4xl">🎉</p>
          <h2 className="mt-4 text-xl font-bold">가입이 완료되었습니다</h2>
          <p className="mt-2 text-[var(--color-gray-400)]">
            {step.name}님, 이제 로그인해서 이용하실 수 있습니다.
          </p>
          {/* register 201의 세션 발급 여부가 미확정이라 로그인 유도로 간다 (SPEC_API §2.2 ❓) */}
          <Link
            href="/login"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)]"
          >
            로그인하기
          </Link>
        </div>
      );
  }
}

function VerifyStep({
  onVerified,
}: {
  onVerified: (verified: VerifyRosterResult, input: VerifyValues) => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<VerifyValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { name: "", birthDate: "", phone: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: VerifyValues) => api.auth.verifyRoster(input),
    onSuccess: (verified, input) => onVerified(verified, input),
    onError: (error) => {
      if (isApiError(error) && error.code === "VALIDATION_ERROR") {
        // 동명이인 2건 이상 — 사용자가 입력으로 풀 수 없는 상태다 (SPEC_API §2.1)
        setError("root", {
          type: "duplicate-name",
          message: "동명이인 확인이 필요합니다. 임원에게 문의해 주세요.",
        });
        return;
      }
      /*
       * 불일치·명단 없음·이미 계정·rate limit — 전부 같은 단일 문구.
       * 어느 필드가 틀렸는지 붙이지 않는다 (SPEC_API §2.1 명단 정보 탐색 방지).
       */
      setError("root", {
        message: isApiError(error)
          ? error.message
          : "확인에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  return (
    <div className="mx-auto w-full max-w-sm">
      <p className="leading-relaxed text-[var(--color-gray-400)]">
        청년교회 명단과 대조해 본인을 확인합니다.
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-bold">
            이름
          </label>
          <input id="name" type="text" autoComplete="name" className={inputClass} {...register("name")} />
          <p className="mt-1 text-xs text-[var(--color-gray-400)]">
            ⓘ 동명이인은 명단의 알파벳까지 입력해주세요 (예: 김도연a)
          </p>
          {errors.name && (
            <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="birthDate" className="mb-1 block text-sm font-bold">
            생년월일
          </label>
          <input
            id="birthDate"
            type="text"
            inputMode="numeric"
            placeholder="2001-03-14"
            autoComplete="bday"
            className={inputClass}
            {...register("birthDate")}
          />
          {errors.birthDate && (
            <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">{errors.birthDate.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-bold">
            전화번호
          </label>
          <input
            id="phone"
            type="tel"
            placeholder="010-0000-0000"
            autoComplete="tel"
            className={inputClass}
            {...register("phone")}
          />
          {errors.phone && (
            <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">{errors.phone.message}</p>
          )}
        </div>

        {errors.root && (
          <p role="alert" className="text-sm font-bold text-[var(--color-red-500)]">
            ⚠ {errors.root.message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "확인 중..." : "확인하기"}
        </Button>
      </form>

      <div className="mt-6 text-sm">
        <Link href="/login" className="flex min-h-11 items-center text-[var(--color-gray-400)]">
          ▸ 이미 계정이 있으신가요? 로그인
        </Link>
      </div>
    </div>
  );
}

function RegisterStep({
  verified,
  verifyInput,
  onExpired,
  onDone,
}: {
  verified: VerifyRosterResult;
  verifyInput: VerifyValues;
  onExpired: () => void;
  onDone: (name: string) => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(verified.expiresIn);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) onExpired();
  }, [secondsLeft, onExpired]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { loginId: "", password: "", passwordConfirm: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: RegisterValues) =>
      api.auth.register({
        registrationToken: verified.registrationToken,
        loginId: values.loginId,
        password: values.password,
      }),
    onSuccess: (result) => onDone(result.name),
    onError: (error) => {
      if (isApiError(error) && error.code === "UNAUTHORIZED") {
        // 토큰 만료·재사용 (SPEC_API §2.2)
        onExpired();
        return;
      }
      if (isApiError(error) && error.field === "loginId") {
        setError("loginId", { message: error.message });
        return;
      }
      if (isApiError(error) && error.field === "password") {
        setError("password", { message: error.message });
        return;
      }
      setError("root", {
        message: isApiError(error)
          ? error.message
          : "가입에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  function handleRegister(values: RegisterValues) {
    // 서버 규칙(SPEC_API §2.2)을 미리 걸러 왕복을 줄인다 — 최종 판단은 서버
    const digits = values.password.replace(/\D/g, "");
    if (digits === verifyInput.birthDate.replace(/\D/g, "") || digits === verifyInput.phone.replace(/\D/g, "")) {
      setError("password", { message: "생년월일·전화번호와 같은 비밀번호는 사용할 수 없습니다." });
      return;
    }
    mutation.mutate(values);
  }

  const mm = String(Math.floor(secondsLeft / 60));
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="mx-auto w-full max-w-sm">
      <h2 className="text-xl font-bold">{verified.name}님, 확인되었습니다</h2>
      <p className="mt-1 text-[var(--color-gray-400)]">
        로그인 수단을 선택해주세요.{" "}
        <span aria-live="polite" className="font-bold">
          ({mm}:{ss} 내에 완료)
        </span>
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(handleRegister)}>
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
            autoComplete="new-password"
            className={inputClass}
            {...register("password")}
          />
          <p className="mt-1 text-xs text-[var(--color-gray-400)]">
            8자 이상 · 생년월일/전화번호와 같으면 사용할 수 없습니다
          </p>
          {errors.password && (
            <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="passwordConfirm" className="mb-1 block text-sm font-bold">
            비밀번호 확인
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
          {mutation.isPending ? "가입 중..." : "가입하기"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-sm text-[var(--color-gray-400)]">
        <hr className="flex-1 border-[var(--color-navy-100)]" />
        또는
        <hr className="flex-1 border-[var(--color-navy-100)]" />
      </div>

      {/*
        가입 경로의 카카오 — 명단 확인을 통과한 뒤에만 노출된다 (SPEC_API §2.7).
        ⚠️ registrationToken 전달 방식은 BE 미확정 — 쿼리 파라미터로 넘기는 것은
        FE 제안이다 (BACKEND_HANDOFF.md 2026-08-31). 서버가 OAuth state에 실어
        콜백에서 회수하는 형태를 권장.
      */}
      <a
        href={`/api/auth/kakao/authorize?registrationToken=${encodeURIComponent(verified.registrationToken)}`}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[#FEE500] px-6 text-base font-bold text-[#191919] transition hover:brightness-95"
      >
        💬 본인 확인 후 카카오로 계속
      </a>
    </div>
  );
}
