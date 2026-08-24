import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { CompleteProfileForm } from "./CompleteProfileForm";

export const metadata: Metadata = {
  title: "추가 정보 입력 | LIGHT",
  description: "카카오 가입 후 승인에 필요한 추가 정보를 입력합니다.",
};

/** WIREFRAME.md §10-2b */
export default function CompleteProfilePage() {
  return (
    <main>
      <Section>
        <CompleteProfileForm />
      </Section>
    </main>
  );
}
