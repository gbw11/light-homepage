import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { SignupFlow } from "./SignupFlow";

export const metadata: Metadata = {
  title: "회원가입",
  description: "청년교회 명단 확인으로 가입합니다.",
  robots: { index: false },
};

/** WIREFRAME.md §10-2 — 명단 확인 2단계 가입 (SPEC_API §2.1~2.2 v1.3) */
export default function SignupPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="mb-8 text-center text-2xl font-bold md:text-3xl">회원가입</h1>
        <SignupFlow />
      </Section>
    </main>
  );
}
