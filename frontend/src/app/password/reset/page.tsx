import type { Metadata } from "next";
import { Suspense } from "react";
import { Section } from "@/components/ui/Section";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = {
  title: "비밀번호 재설정 | LIGHT",
  description: "LIGHT 새 비밀번호 설정.",
};

/**
 * SPEC_API.md §2.10
 * ResetForm이 useSearchParams()를 쓰므로 Next.js App Router 규칙상
 * Suspense 경계로 감싼다.
 */
export default function PasswordResetPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section title="새 비밀번호 설정" titleAs="h1">
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </Section>
    </main>
  );
}
