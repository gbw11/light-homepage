import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { ResetRequestForm } from "./ResetRequestForm";

export const metadata: Metadata = {
  title: "비밀번호 재설정 요청 | LIGHT",
  description: "LIGHT 비밀번호 재설정 메일 요청.",
};

/** SPEC_API.md §2.9 */
export default function PasswordResetRequestPage() {
  return (
    <main>
      <Section title="비밀번호 재설정" titleAs="h1">
        <ResetRequestForm />
      </Section>
    </main>
  );
}
