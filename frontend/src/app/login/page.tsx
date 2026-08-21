import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "로그인 | LIGHT",
  description: "LIGHT 로그인 페이지 (준비 중).",
};

/**
 * 로그인 placeholder. 실제 로그인 폼/인증 로직은 이번 단위에서 만들지 않는다
 * (PM이 이후 별도로 진행하기로 함, docs/DECISIONS.md 참고).
 */
export default function LoginPage() {
  return (
    <main>
      <Section title="로그인">
        <p className="leading-relaxed text-[var(--color-gray-400)]">
          이메일·카카오 로그인은 준비 중입니다.
        </p>

        <Link href="/welcome" className="mt-6 inline-block text-sm font-bold">
          ▸ 처음 오시는 분이신가요?
        </Link>
      </Section>
    </main>
  );
}
