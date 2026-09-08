"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/AuthProvider";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { HomeTile } from "./_components/HomeTile";
import { MyPreviews } from "./_components/MyPreviews";

/**
 * WIREFRAME.md §11 — 나의 LIGHT `/my` (회원 홈).
 *
 * "이번 주 주보"/"최근 앨범" 미리보기는 주보·사진첩 API가 생긴 뒤
 * 2026-08-25에 추가했다 (`_components/MyPreviews.tsx`).
 * PWA "홈 화면에 추가" 배너는 `/home`으로 옮겼다 — 공개 열람 전환으로
 * 비회원도 앱처럼 쓸 수 있게 되면서 설치 대상이 회원으로 한정되지 않는다.
 *
 * 사진첩·주보는 M3에서 `/photos`·`/bulletin`으로 구현돼 타일이
 * 활성화됐다. 월례회 자료도 M4에서 `/meetings`(WIREFRAME.md §14b)가
 * 생겨 "준비 중" 비활성 타일을 걷어냈다.
 *
 * 관리 타일(콘텐츠 작성/회의록)은 LEADER·PASTOR에게만 보이는 UI 편의
 * 기능이다 — 실제 인가는 서버가 한다 (RequireMember와 동일 원칙,
 * docs/spec/WORKPLAN.md §5.1). M4에서 두 타일 모두 활성화됐다 — 회의록은 문서
 * 게시판(`/documents` — 회의록·예산안 탭), 콘텐츠 작성은 글 작성 화면
 * (`/admin/posts/new` — WIREFRAME.md §16).
 *
 * 관리 홈(`/admin` — WIREFRAME.md §15)도 M4에서 생겨 타일을 추가했다. 이
 * 타일이 임원 이상에게만 보이는 것과 별개로, 관리 홈 안의 회원 관리는
 * **전도사 전용**이다 (SPEC_API §8 — 항목마다 권한이 다르다).
 */
export default function MyHomePage() {
  return <MyHomeContent />;
}

/**
 * 공개 열람 전환(PM 결정 2026-08-25) 이후 이 화면의 역할이 바뀌었다.
 * 자료(주보·사진첩·공지·월례회·회의록)는 공개 주소로 옮겨가 헤더 메뉴에서
 * 바로 갈 수 있으므로, 여기는 **로그인한 사람에게만 의미가 있는 것**만 남긴다:
 * 내 정보와, 권한이 있으면 관리 진입점. 익명에게는 로그인 안내를 보여준다.
 *
 * LIGHT-26: 로그아웃은 `/my` → 내 정보 → 계정 관리로 3단계 깊이였다 —
 * 가장 자주 쓰는 동작인데 가장 깊은 곳에 있었다. 여기 최상단으로 옮겨
 * 바로 눌리게 한다. 회원 탈퇴는 되돌릴 수 없는 파괴적 동작이라 여기로
 * 같이 옮기지 않고 `/my/profile`의 `AccountActions`에 그대로 둔다
 * (로그아웃 옆에 두면 오클릭 위험이 커진다).
 */
function MyHomeContent() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const member = user;
  const isAdmin = member?.role === "LEADER" || member?.role === "PASTOR";

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => router.push("/"),
  });

  if (!member) {
    return (
      <main id="main" tabIndex={-1}>
        <Section>
          <h1 className="text-2xl font-bold md:text-3xl">나의 LIGHT</h1>
          <p className="mt-2 leading-relaxed text-[var(--color-gray-400)]">
            로그인하면 주보·사진첩·내부 공지·월례회 자료를 볼 수 있습니다.
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)]"
            >
              로그인
            </Link>
          </div>
        </Section>
      </main>
    );
  }

  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold md:text-3xl">안녕하세요, {member.name}님</h1>
          <Button
            type="button"
            variant="secondary"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? "로그아웃 중..." : "로그아웃"}
          </Button>
        </div>

        {/* 이번 주 주보 · 최근 앨범 (FR-MEM-01) — `_components/MyPreviews.tsx` */}
        <div className="mt-8">
          <MyPreviews />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <HomeTile icon="⚙️" label="내 정보" href="/my/profile" />
          <HomeTile icon="📄" label="주보" href="/bulletin" />
          <HomeTile icon="📷" label="사진첩" href="/photos" />
          <HomeTile icon="🗂" label="월례회 자료" href="/meetings" />
        </div>

        {isAdmin && (
          <div className="mt-10">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-gray-400)]">
              관리 (임원 이상만 표시)
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <HomeTile icon="✏️" label="콘텐츠 작성" href="/admin/posts/new" />
              <HomeTile icon="📋" label="문서" href="/documents" />
              <HomeTile icon="🛠" label="관리 홈" href="/admin" className="col-span-2" />
            </div>
          </div>
        )}
      </Section>
    </main>
  );
}
