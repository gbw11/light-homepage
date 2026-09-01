import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { ResetWithCodeForm } from "./ResetWithCodeForm";

export const metadata: Metadata = {
  title: "비밀번호 재설정",
  description: "전도사님께 받은 재설정 코드로 비밀번호를 변경합니다.",
  robots: { index: false },
};

/** WIREFRAME.md §10-4 — 리셋 코드 방식 (SPEC_API §2.9 v1.3) */
export default function PasswordResetPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="mb-8 text-center text-2xl font-bold md:text-3xl">비밀번호 재설정</h1>
        <ResetWithCodeForm />
      </Section>
    </main>
  );
}
