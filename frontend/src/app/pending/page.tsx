import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { PendingActions } from "./PendingActions";

export const metadata: Metadata = {
  title: "승인 대기",
  description: "가입 신청이 접수되어 관리자 승인을 기다리고 있습니다.",
};

/**
 * WIREFRAME.md §10-3. `PENDING` 상태 회원이 다른 경로 접근 시 이동하는 화면.
 * 이 화면 자체는 역할별로 리다이렉트하지 않는다 — 실수로 들어온 승인된
 * 회원도 그냥 이 정적 안내만 보면 된다 (로그아웃 버튼만 실제 인증 상태 사용).
 */
export default function PendingPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="text-center">
        <div className="mx-auto max-w-sm space-y-6">
          <p className="text-5xl" aria-hidden="true">
            ⏳
          </p>
          <h1 className="text-xl font-bold">가입 신청이 접수되었습니다</h1>
          <p className="leading-relaxed text-[var(--color-gray-400)]">
            관리자 확인 후 이용하실 수 있습니다. 보통 하루 안에 처리됩니다.
          </p>
          <p className="text-sm text-[var(--color-gray-400)]">
            문의 ▸ 카카오톡 / 055-333-6321
          </p>
          <PendingActions />
        </div>
      </Section>
    </main>
  );
}
