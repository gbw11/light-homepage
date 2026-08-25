"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Section } from "@/components/ui/Section";
import { villageLabel } from "@/lib/village";
import { HomeTile } from "./_components/HomeTile";

/**
 * WIREFRAME.md §11 — 나의 LIGHT `/my` (회원 홈).
 *
 * 이번 단위 범위: 인사말 + 타일 그리드만 구현한다. "이번 주 주보"/"최근 앨범"
 * 미리보기와 PWA "홈 화면에 추가" 배너는 주보·사진첩 데이터(M3)가 있어야
 * 의미가 있어 생략했다 — WORKFLOW.md 분해 원칙(눈에 보이는 최소 단위)에 맞춰
 * 데이터가 준비되면 별도 단위로 추가한다.
 *
 * 사진첩·주보는 M3에서 `/my/photos`·`/my/bulletin`으로 구현돼 타일이
 * 활성화됐다. 월례회 자료도 M4에서 `/my/meetings`(WIREFRAME.md §14b)가
 * 생겨 "준비 중" 비활성 타일을 걷어냈다.
 *
 * 관리 타일(콘텐츠 작성/회의록)은 LEADER·PASTOR에게만 보이는 UI 편의
 * 기능이다 — 실제 인가는 서버가 한다 (RequireMember와 동일 원칙,
 * docs/WORKPLAN.md §5.1). M4에서 두 타일 모두 활성화됐다 — 회의록은 문서
 * 게시판(`/my/documents` — 회의록·예산안 탭), 콘텐츠 작성은 글 작성 화면
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
 * 공개 열람 전환(PM 결정 2026-08-25): 이 화면은 더 이상 로그인을 요구하지
 * 않는다. 로그인한 사용자에게는 인사말·내 정보 타일을, 익명 방문자에게는
 * 로그인 안내를 보여준다 — 타일(주보·사진첩·공지·월례회)은 누구에게나 열린다.
 */
function MyHomeContent() {
  const { user } = useAuth();
  const member = user && user.role !== "PENDING" ? user : null;
  const isAdmin = member?.role === "LEADER" || member?.role === "PASTOR";

  return (
    <main id="main" tabIndex={-1}>
      <Section>
        {member ? (
          <>
            <h1 className="text-2xl font-bold md:text-3xl">
              안녕하세요, {member.name}님
            </h1>
            <p className="mt-1 text-[var(--color-gray-400)]">
              {villageLabel(member.village)}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold md:text-3xl">LIGHT 자료</h1>
            <p className="mt-1 text-[var(--color-gray-400)]">
              주보·사진첩·공지·월례회 자료는 누구나 볼 수 있습니다.{" "}
              <Link href="/login" className="font-bold underline">
                로그인
              </Link>
              하면 자료 업로드 등 맡은 권한으로 활동할 수 있습니다.
            </p>
          </>
        )}

        <div className="mt-8 grid grid-cols-2 gap-4">
          <HomeTile icon="📄" label="주보" href="/my/bulletin" />
          <HomeTile icon="📷" label="사진첩" href="/my/photos" />
          <HomeTile icon="📢" label="공지사항" href="/my/notices" />
          {member ? (
            <HomeTile icon="⚙️" label="내 정보" href="/my/profile" />
          ) : (
            <HomeTile icon="🔑" label="로그인" href="/login" />
          )}
          <HomeTile
            icon="🗂"
            label="월례회 자료"
            href="/my/meetings"
            className="col-span-2"
          />
        </div>

        {isAdmin && (
          <div className="mt-10">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-gray-400)]">
              관리 (임원 이상만 표시)
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <HomeTile icon="✏️" label="콘텐츠 작성" href="/admin/posts/new" />
              <HomeTile icon="📋" label="회의록" href="/my/documents" />
              <HomeTile
                icon="🛠"
                label="관리 홈"
                href="/admin"
                className="col-span-2"
              />
            </div>
          </div>
        )}
      </Section>
    </main>
  );
}
