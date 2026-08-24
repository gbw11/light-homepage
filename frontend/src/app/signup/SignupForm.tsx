"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { SignupInput } from "@/types/api";
import { Button } from "@/components/ui/Button";

const VILLAGES = [
  { value: "1", label: "1마을" },
  { value: "2", label: "2마을" },
  { value: "3", label: "3마을" },
  { value: "4", label: "4마을" },
  { value: "5", label: "5마을" },
  { value: "6", label: "6마을" },
  { value: "7", label: "7마을" },
  { value: "8", label: "8마을" },
  { value: "9", label: "9마을" },
  { value: "newcomer", label: "새가족" },
] as const;

/** WIREFRAME.md §10-2, SPEC_API.md §2.1 */
const schema = z
  .object({
    name: z.string().trim().min(2, "이름은 2자 이상 입력해주세요.").max(50),
    email: z.string().trim().min(1, "이메일을 입력해주세요.").email("이메일 형식이 아닙니다."),
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
    passwordConfirm: z.string().min(1, "비밀번호 확인을 입력해주세요."),
    phone: z
      .string()
      .trim()
      .regex(/^010-\d{4}-\d{4}$/, "010-0000-0000 형식으로 입력해주세요."),
    village: z.enum(VILLAGES.map((v) => v.value) as [string, ...string[]], {
      message: "소속 마을을 선택해주세요.",
    }),
    agreed: z.boolean().refine((v) => v === true, {
      message: "개인정보 수집·이용에 동의해주세요.",
    }),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

type FormValues = z.infer<typeof schema>;

function toSignupInput(values: FormValues): SignupInput {
  return {
    name: values.name,
    email: values.email,
    password: values.password,
    phone: values.phone,
    village: values.village as SignupInput["village"],
    agreed: values.agreed,
  };
}

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

export function SignupForm() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      passwordConfirm: "",
      phone: "",
      village: undefined,
      agreed: false,
    },
  });

  const mutation = useMutation({
    mutationFn: (input: SignupInput) => api.auth.signup(input),
    onSuccess: () => setSubmitted(true),
    onError: (error) => {
      if (isApiError(error) && error.field) {
        setError(error.field as keyof FormValues, { message: error.message });
        return;
      }
      setError("root", {
        message: isApiError(error) ? error.message : "가입에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  if (submitted) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <p className="text-xl font-bold">가입 신청이 접수됐습니다</p>
        <p className="mt-2 leading-relaxed text-[var(--color-gray-400)]">
          관리자 승인 후 이용하실 수 있습니다. 승인 전에는 로그인 시 승인 대기
          안내로 이동합니다.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-navy-900)] transition hover:brightness-95"
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  return (
    <form
      className="mx-auto max-w-sm space-y-5"
      onSubmit={handleSubmit((values) => mutation.mutate(toSignupInput(values)))}
    >
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-bold">
          이름 *
        </label>
        <input id="name" className={inputClass} {...register("name")} />
        {errors.name && (
          <p className="mt-1 text-sm text-[var(--color-red-500)]">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-bold">
          이메일 *
        </label>
        <input id="email" type="email" className={inputClass} {...register("email")} />
        {errors.email && (
          <p className="mt-1 text-sm text-[var(--color-red-500)]">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-bold">
          비밀번호 *
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          {...register("password")}
        />
        {errors.password && (
          <p className="mt-1 text-sm text-[var(--color-red-500)]">{errors.password.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="passwordConfirm" className="mb-1 block text-sm font-bold">
          비밀번호 확인 *
        </label>
        <input
          id="passwordConfirm"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          {...register("passwordConfirm")}
        />
        {errors.passwordConfirm && (
          <p className="mt-1 text-sm text-[var(--color-red-500)]">
            {errors.passwordConfirm.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-bold">
          연락처 *
        </label>
        <input
          id="phone"
          type="tel"
          placeholder="010-1234-5678"
          className={inputClass}
          {...register("phone")}
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-[var(--color-red-500)]">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="village" className="mb-1 block text-sm font-bold">
          소속 마을 *
        </label>
        <select id="village" className={inputClass} defaultValue="" {...register("village")}>
          <option value="" disabled>
            선택해주세요
          </option>
          {VILLAGES.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
        {errors.village && (
          <p className="mt-1 text-sm text-[var(--color-red-500)]">{errors.village.message}</p>
        )}
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" {...register("agreed")} />
          <span>개인정보 수집·이용 동의 *</span>
        </label>
        {errors.agreed && (
          <p className="mt-1 text-sm text-[var(--color-red-500)]">{errors.agreed.message}</p>
        )}
      </div>

      <p className="text-sm text-[var(--color-gray-400)]">
        ⓘ 가입 후 관리자 승인이 필요합니다.
      </p>

      {errors.root && (
        <p className="text-sm text-[var(--color-red-500)]">{errors.root.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "가입 신청 중..." : "가입 신청"}
      </Button>
    </form>
  );
}
