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

          {/*
            카카오 가입자는 비밀번호가 없다 (SPEC_API §2.6 — loginId가 null).
            폼을 보여주면 제출해도 서버가 거부할 뿐이다 (USERFLOW_AUDIT 🔵-8).
          */}
          {user.loginId != null ? (
            <PasswordChangeForm />
          ) : (
            <p className="text-sm leading-relaxed text-[var(--color-gray-400)]">
              ⓘ 카카오로 가입한 계정은 비밀번호가 없습니다. 카카오 로그인을 이용해주세요.
            </p>
          )}

          <hr className="border-[var(--color-navy-100)]" />

          <AccountActions />
        </div>
      </Section>
    </main>
  );
}
