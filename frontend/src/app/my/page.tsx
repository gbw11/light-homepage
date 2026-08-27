"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Section } from "@/components/ui/Section";
import { villageLabel } from "@/lib/village";
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
 * docs/WORKPLAN.md §5.1). M4에서 두 타일 모두 활성화됐다 — 회의록은 문서
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
 */
function MyHomeContent() {
  const { user } = useAuth();
  const member = user && user.role !== "PENDING" ? user : null;
  const isAdmin = member?.role === "LEADER" || member?.role === "PASTOR";

  if (!member) {
    return (
      <main id="main" tabIndex={-1}>
        <Section>
          <h1 className="text-2xl font-bold md:text-3xl">나의 LIGHT</h1>
          <p className="mt-2 leading-relaxed text-[var(--color-gray-400)]">
            {user?.role === "PENDING"
              ? "가입 승인을 기다리는 중입니다. 승인되면 맡은 역할에 따라 자료를 올릴 수 있습니다."
              : "주보·사진첩·공지·월례회 자료는 로그인 없이 볼 수 있습니다. 로그인은 자료를 올리거나 관리해야 하는 분을 위한 것입니다."}
          </p>
          {user?.role !== "PENDING" && (
            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)]"
              >
                로그인
              </Link>
            </div>
          )}
        </Section>
      </main>
    );
  }

  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">안녕하세요, {member.name}님</h1>
        <p className="mt-1 text-[var(--color-gray-400)]">{villageLabel(member.village)}</p>

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
