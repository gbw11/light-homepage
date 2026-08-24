"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { NewcomerSubmission } from "@/types/api";
import { Button } from "@/components/ui/Button";

/**
 * WIREFRAME.md §9, SPEC_API.md §9.1(POST /api/newcomers), FR-PUB-08.
 * 필수: name · phone · agreed(true). 나머지는 선택.
 */
const schema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요."),
  phone: z.string().trim().min(1, "연락처를 입력해주세요."),
  gender: z.union([z.literal("MALE"), z.literal("FEMALE"), z.literal("")]).optional(),
  ageGroup: z
    .union([
      z.literal("EARLY_20S"),
      z.literal("LATE_20S"),
      z.literal("EARLY_30S"),
      z.literal("LATE_30S"),
      z.literal(""),
    ])
    .optional(),
  referrer: z
    .union([
      z.literal("FRIEND"),
      z.literal("SEARCH"),
      z.literal("SNS"),
      z.literal("ETC"),
      z.literal(""),
    ])
    .optional(),
  message: z.string().optional(),
  agreed: z.boolean().refine((v) => v === true, {
    message: "개인정보 수집·이용에 동의해주세요.",
  }),
  honeypot: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function toSubmission(values: FormValues): NewcomerSubmission {
  return {
    name: values.name,
    phone: values.phone,
    gender: values.gender ? values.gender : undefined,
    ageGroup: values.ageGroup ? values.ageGroup : undefined,
    referrer: values.referrer ? values.referrer : undefined,
    message: values.message?.trim() ? values.message.trim() : undefined,
    agreed: values.agreed,
    honeypot: values.honeypot,
  };
}

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

function RegisterFormInner() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phone: "",
      gender: "",
      ageGroup: "",
      referrer: "",
      message: "",
      agreed: false,
      honeypot: "",
    },
  });

  const agreed = useWatch({ control, name: "agreed" });

  const mutation = useMutation({
    mutationFn: (input: NewcomerSubmission) => api.newcomers.submit(input),
    onSuccess: () => setSubmitted(true),
    onError: (error) => {
      if (isApiError(error) && error.field) {
        setError(error.field as keyof FormValues, { message: error.message });
        return;
      }
      setError("root", {
        message: isApiError(error) ? error.message : "등록에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  if (submitted) {
    return (
      <div className="text-center">
        <p className="text-xl font-bold">등록됐습니다 🎉</p>
        <p className="mt-2 text-base text-[var(--color-gray-400)]">
          주일에 뵙겠습니다.
        </p>
        <Link
          href="/location"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-navy-900)] transition hover:brightness-95"
        >
          오시는 길 확인하기
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit((values) => mutation.mutate(toSubmission(values)))}
    >
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-bold">
          이름 *
        </label>
        <input id="name" className={inputClass} {...register("name")} />
        {errors.name && (
          <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">{errors.name.message}</p>
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
          <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <span className="mb-1 block text-sm font-bold">성별</span>
        <div className="flex gap-2">
          <label className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] px-4">
            <input type="radio" value="MALE" {...register("gender")} /> 남
          </label>
          <label className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] px-4">
            <input type="radio" value="FEMALE" {...register("gender")} /> 여
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="ageGroup" className="mb-1 block text-sm font-bold">
          나이대
        </label>
        <select id="ageGroup" className={inputClass} {...register("ageGroup")}>
          <option value="">선택 안 함</option>
          <option value="EARLY_20S">20대 초반</option>
          <option value="LATE_20S">20대 후반</option>
          <option value="EARLY_30S">30대 초반</option>
          <option value="LATE_30S">30대 후반</option>
        </select>
      </div>

      <div>
        <label htmlFor="referrer" className="mb-1 block text-sm font-bold">
          어떻게 알게 되셨나요?
        </label>
        <select id="referrer" className={inputClass} {...register("referrer")}>
          <option value="">선택 안 함</option>
          <option value="FRIEND">지인 소개</option>
          <option value="SEARCH">검색</option>
          <option value="SNS">SNS</option>
          <option value="ETC">기타</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-bold">
          남기고 싶은 말
        </label>
        <textarea id="message" rows={3} className={inputClass} {...register("message")} />
      </div>

      {/* 스팸 방지 honeypot — 실제 사용자에게는 보이지 않는다 (WIREFRAME.md §9) */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        {...register("honeypot")}
      />

      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" {...register("agreed")} />
          <span>
            개인정보 수집·이용 동의 *
            <br />
            <span className="text-[var(--color-gray-400)]">
              수집 항목: 이름·연락처. 목적: 새가족 안내. 보유 기간: 등록일로부터 1년.
            </span>
          </span>
        </label>
        {errors.agreed && (
          <p role="alert" className="mt-1 text-sm text-[var(--color-red-500)]">{errors.agreed.message}</p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-sm text-[var(--color-red-500)]">{errors.root.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={!agreed || mutation.isPending}>
        {mutation.isPending ? "등록 중..." : "등록하기"}
      </Button>
    </form>
  );
}

/** RegisterFormInner가 useMutation을 쓰려면 QueryClientProvider가 필요하다.
 *  앱 전역 Provider가 아직 없으므로 이 페이지 트리 안에서만 생성해서 쓴다. */
export function RegisterForm() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <RegisterFormInner />
    </QueryClientProvider>
  );
}
