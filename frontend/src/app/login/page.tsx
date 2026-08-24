import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "로그인 | LIGHT",
  description: "LIGHT 이메일·카카오 로그인.",
};

/** WIREFRAME.md §10-1 */
export default function LoginPage() {
  return (
    <main>
      <Section title="로그인" titleAs="h1">
        <LoginForm />
      </Section>
    </main>
  );
}
