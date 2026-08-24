import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "회원가입 | LIGHT",
  description: "LIGHT 이메일 회원가입.",
};

/** WIREFRAME.md §10-2 */
export default function SignupPage() {
  return (
    <main>
      <Section title="회원가입" titleAs="h1">
        <SignupForm />
      </Section>
    </main>
  );
}
