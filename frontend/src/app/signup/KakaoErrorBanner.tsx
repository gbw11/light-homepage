"use client";

import { useSearchParams } from "next/navigation";

/**
 * `/signup?error=kakao` 안내 (SPEC_API §2.8 · USERFLOW_AUDIT 2026-10-07 🟠-2).
 *
 * 카카오 콜백이 실패하면 서버는 이유와 상관없이 이 주소로 보낸다 — 가입하지
 * 않은 카카오 계정, 본인 확인(registrationToken) 없음·만료 등. 안내 없이 빈
 * 가입 폼만 보이면 사용자는 무슨 일이 있었는지 모른다.
 *
 * 페이지 자체는 정적으로 두고 이 배너만 `Suspense` 안에서 그린다
 * (`useSearchParams`는 정적 렌더에서 Suspense 경계가 필요하다).
 */
export function KakaoErrorBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "kakao") return null;

  return (
    <p
      role="alert"
      className="mx-auto mb-6 w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--color-red-500)] px-4 py-3 text-sm font-bold text-[var(--color-red-500)]"
    >
      ⚠ 카카오 로그인을 완료하지 못했습니다. 아직 가입하지 않으셨다면 아래에서 명단 확인부터
      다시 진행해주세요.
    </p>
  );
}
