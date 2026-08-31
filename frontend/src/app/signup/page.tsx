import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "회원가입",
  description: "청년교회 명단 확인으로 가입합니다.",
  robots: { index: false },
};

/**
 * WIREFRAME.md §10-2 — 명단 확인 2단계 가입 (SPEC_API §2.1~2.2 v1.3).
 *
 * ⚠️ 임시 안내 화면이다 — 구모델(이메일 가입 폼)은 2026-08-31 재설계 확정으로
 * 걷어냈고, 명단 확인 2단계 폼은 다음 PR에서 구현한다.
 */
export default function SignupPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">회원가입</h1>
        <p className="mt-4 leading-relaxed text-[var(--color-gray-400)]">
          새로운 가입 방식(청년교회 명단 확인)을 준비하고 있습니다. 잠시 후 다시
          찾아주세요.
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
