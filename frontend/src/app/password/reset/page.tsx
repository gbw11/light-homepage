import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "비밀번호 재설정",
  description: "전도사님께 받은 재설정 코드로 비밀번호를 변경합니다.",
  robots: { index: false },
};

/**
 * WIREFRAME.md §10-4 — 리셋 코드 방식 (SPEC_API §2.9 v1.3).
 *
 * ⚠️ 임시 안내 화면이다 — 구모델(이메일 링크)은 2026-08-31 재설계 확정으로
 * 걷어냈고, 코드 입력 폼은 다음 PR에서 구현한다.
 */
export default function PasswordResetPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">비밀번호 재설정</h1>
        <p className="mt-4 leading-relaxed text-[var(--color-gray-400)]">
          전도사님께 문의하시면 재설정 코드를 받을 수 있습니다. 코드 입력 화면을
          준비하고 있습니다.
        </p>
        <p className="mt-2 leading-relaxed text-[var(--color-gray-400)]">
          카카오로 가입하셨다면 비밀번호 없이 카카오 로그인을 이용하세요.
        </p>
        <div className="mt-6">
          <Link href="/login" className="text-sm font-bold underline underline-offset-2">
            ▸ 로그인으로 돌아가기
          </Link>
        </div>
      </Section>
    </main>
  );
}
