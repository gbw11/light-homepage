"use client";

import { RequireMember } from "@/components/auth/RequireMember";
import { Section } from "@/components/ui/Section";
import { useAuth } from "@/components/providers/AuthProvider";
import { ProfileInfo } from "./_components/ProfileInfo";
import { PasswordChangeForm } from "./_components/PasswordChangeForm";
import { AccountActions } from "./_components/AccountActions";

/** WIREFRAME.md §14 우측 — 내 정보 `/my/profile` */
export default function ProfilePage() {
  return (
    <RequireMember>
      <ProfileContent />
    </RequireMember>
  );
}

function ProfileContent() {
  const { user, refetch } = useAuth();

  // RequireMember가 로딩/비로그인/승인대기를 이미 걸러내지만, 타입상으로는
  // 여전히 null일 수 있어 방어적으로 처리한다.
  if (!user) return null;

  return (
    <main id="main" tabIndex={-1}>
      <Section title="내 정보" titleAs="h1">
        <div className="mx-auto w-full max-w-md space-y-10">
          <ProfileInfo user={user} onUpdated={refetch} />

          <hr className="border-[var(--color-navy-100)]" />

          <PasswordChangeForm />

          <hr className="border-[var(--color-navy-100)]" />

          <AccountActions />
        </div>
      </Section>
    </main>
  );
}
