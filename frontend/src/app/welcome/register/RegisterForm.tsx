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
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
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
        <label className="flex min-h-11 items-start gap-2 py-2 text-sm">
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

/**
 * 🔴 **배포된 mock 빌드에서는 폼을 띄우지 않는다.**
 *
 * 이 폼이 받는 것은 **실명과 휴대폰 번호**다. 그런데 mock의
 * `newcomers.submit`은 `{ id: Date.now() }`를 돌려주고 입력을 **버린다**
 * (`mock.ts`). 즉 배포된 데모에서 처음 온 청년이 이름과 연락처를 적으면
 * 화면은 "등록됐습니다 🎉"라고 말하는데 **아무도 그 사람에게 연락하지 않는다.**
 *
 * 이건 mock의 다른 no-op들과 성질이 다르다. 사진 삭제가 되살아나는 것은
 * 화면이 이상해 보이는 문제이고(`PhotoDeletePanel`), 이쪽은
 * **① 개인정보를 처리자 없이 받는다 ② 방문자에게 지키지 못할 약속을 한다** —
 * 둘 다 문구로 덧붙여 감쌀 수 있는 종류가 아니다. 그래서 안내로 **대체**한다.
 *
 * ## 게이트가 두 값의 AND인 이유
 *
 * `NEXT_PUBLIC_USE_MOCK`만으로 막으면 **로컬 개발에서도 폼이 사라진다** —
 * 개발은 mock 모드가 기본이라 폼을 만들 수도 고칠 수도 없게 된다.
 * `NODE_ENV`만으로 막으면 BE를 연결한 실서비스 빌드(`mock=0`)에서도 막힌다.
 * 막아야 하는 것은 **"배포됐는데 저장될 곳이 없는"** 조합 하나뿐이다.
 * (`mock-assets/[...path]/route.ts`는 자산 전체를 배포에서 지워야 했으므로
 * `NODE_ENV` 단독이 맞았다 — 여기는 대상이 다르다.)
 *
 * 두 값 모두 빌드 타임 상수이므로 `mock=0` 빌드에서는 이 분기가 번들에서
 * 통째로 사라진다.
 *
 * → `NEXT_PUBLIC_USE_MOCK=0`으로 BE를 연결하는 순간 폼이 그대로 살아난다.
 *   이 파일에서 지울 코드는 없다.
 */
const FORM_DISABLED =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_USE_MOCK === "1";

/**
 * 폼을 대신하는 안내. **막았다는 사실보다 지금 무엇을 할 수 있는지를 먼저 준다** —
 * 처음 오려는 사람을 빈손으로 돌려보내지 않는 것이 이 화면의 목적이다.
 * 전화는 이미 확정된 유일한 실제 연락 경로다 (`/contact` · 사무실 번호).
 */
function RegisterUnavailable() {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-6">
      <p className="text-lg font-bold">온라인 등록은 준비 중입니다</p>
      <p className="mt-2 text-base text-[var(--color-gray-400)]">
        아직 등록 내용을 받아둘 곳이 준비되지 않아, 지금 적어주시면 담당자에게
        전달되지 않습니다. 그냥 오셔도 좋고, 미리 알리고 싶으시면 전화로
        말씀해주세요.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
        >
          전화로 문의하기
        </Link>
        <Link
          href="/location"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-4 text-base font-bold transition hover:bg-[var(--color-navy-100)]"
        >
          오시는 길
        </Link>
      </div>

      <p className="mt-4 text-sm text-[var(--color-gray-400)]">
        주일 14:00 · 드림센터 4층. 등록 없이 오셔도 맞이합니다.
      </p>
    </div>
  );
}

/** RegisterFormInner가 useMutation을 쓰려면 QueryClientProvider가 필요하다.
 *  앱 전역 Provider가 아직 없으므로 이 페이지 트리 안에서만 생성해서 쓴다. */
export function RegisterForm() {
  const [queryClient] = useState(() => new QueryClient());

  if (FORM_DISABLED) return <RegisterUnavailable />;

  return (
    <QueryClientProvider client={queryClient}>
      <RegisterFormInner />
    </QueryClientProvider>
  );
}
