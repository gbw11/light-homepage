import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "로그인",
  description: "LIGHT 아이디·카카오 로그인.",
};

/** WIREFRAME.md §10-1 */
export default function LoginPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section title="로그인" titleAs="h1">
        <LoginForm />
      </Section>
    </main>
  );
}
