"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { CompleteProfileInput } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/providers/AuthProvider";

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

/** WIREFRAME.md §10-2b, SPEC_API.md §2.8 */
const schema = z.object({
  name: z.string().trim().min(2, "이름은 2자 이상 입력해주세요.").max(50),
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
});

type FormValues = z.infer<typeof schema>;

function toCompleteProfileInput(values: FormValues): CompleteProfileInput {
  return {
    name: values.name,
    phone: values.phone,
    village: values.village as CompleteProfileInput["village"],
    agreed: values.agreed,
  };
}

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base outline-none focus:border-[var(--color-yellow)]";

export function CompleteProfileForm() {
  const router = useRouter();
  const { user, isLoading, refetch } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  // 이 화면은 카카오 로그인 진행 중(세션은 있으나 프로필 미완성)인 사용자를
  // 전제로 한다. 세션이 없으면 접근할 이유가 없으므로 로그인으로 보낸다.
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phone: "",
      village: undefined,
      agreed: false,
    },
  });

  const mutation = useMutation({
    mutationFn: (input: CompleteProfileInput) => api.auth.completeProfile(input),
    onSuccess: () => {
      setSubmitted(true);
      refetch();
      router.push("/pending");
    },
    onError: (error) => {
      if (isApiError(error) && error.field) {
        setError(error.field as keyof FormValues, { message: error.message });
        return;
      }
      setError("root", {
        message: isApiError(error) ? error.message : "제출에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    },
  });

  if (isLoading || !user) {
    return null;
  }

  return (
    <form
      className="mx-auto max-w-sm space-y-5"
      onSubmit={handleSubmit((values) => mutation.mutate(toCompleteProfileInput(values)))}
    >
      <div>
        <p className="text-xl font-bold">거의 다 됐어요</p>
        <p className="mt-2 text-base text-[var(--color-gray-400)]">
          승인을 위해 아래 정보가 필요합니다
        </p>
      </div>

      <p className="text-sm text-[var(--color-gray-400)]">
        카카오 닉네임: {user.name}
      </p>

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-bold">
          이름(실명) *
        </label>
        <input id="name" className={inputClass} {...register("name")} />
        {errors.name && (
          <p className="mt-1 text-sm text-[var(--color-red-500)]">{errors.name.message}</p>
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

      {errors.root && (
        <p className="text-sm text-[var(--color-red-500)]">{errors.root.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={mutation.isPending || submitted}>
        {mutation.isPending ? "가입 신청 중..." : "가입 신청"}
      </Button>
    </form>
  );
}
