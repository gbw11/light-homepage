import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "새가족 등록 | LIGHT",
  description: "이름과 연락처를 미리 알려주시면 주일에 맞이하겠습니다.",
};

/**
 * WIREFRAME.md §9 `/welcome/register`, SPEC_FUNCTIONAL.md FR-PUB-08.
 */
export default function WelcomeRegisterPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <h1 className="text-2xl font-bold md:text-3xl">새가족 등록</h1>
        <p className="mt-2 text-base text-[var(--color-gray-400)]">
          미리 알려주시면 맞이하겠습니다.
        </p>
      </Section>

      <Section className="pt-0">
        <RegisterForm />
      </Section>
    </main>
  );
}
