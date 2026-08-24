"use client";

import { RequireMember } from "@/components/auth/RequireMember";
import { useAuth } from "@/components/providers/AuthProvider";
import { Section } from "@/components/ui/Section";
import type { Village } from "@/types/api";
import { HomeTile } from "./_components/HomeTile";

function villageLabel(village: Village): string {
  return village === "newcomer" ? "새가족" : `${village}마을`;
}

/**
 * WIREFRAME.md §11 — 나의 LIGHT `/my` (회원 홈).
 *
 * 이번 단위 범위: 인사말 + 타일 그리드만 구현한다. "이번 주 주보"/"최근 앨범"
 * 미리보기와 PWA "홈 화면에 추가" 배너는 주보·사진첩 데이터(M3)가 있어야
 * 의미가 있어 생략했다 — WORKFLOW.md 분해 원칙(눈에 보이는 최소 단위)에 맞춰
 * 데이터가 준비되면 별도 단위로 추가한다.
 *
 * 사진첩·주보는 M3에서 `/my/photos`·`/my/bulletin`으로 구현돼 타일이
 * 활성화됐다. 월례회 자료는 아직 라우트가 없어 news 페이지 갤러리 탭과 같은
 * 패턴(비활성 타일 + "준비 중")으로 남겨둔다 (`frontend/src/app/news/page.tsx`).
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
  return (
    <RequireMember>
      <MyHomeContent />
    </RequireMember>
  );
}

function MyHomeContent() {
  const { user } = useAuth();

  // RequireMember가 로그인 안 됨/승인 대기를 이미 걸러내므로 여기 도달했다면
  // user는 항상 존재한다. 다만 타입은 여전히 nullable이라 방어적으로 처리.
  if (!user) return null;

  const isAdmin = user.role === "LEADER" || user.role === "PASTOR";

  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">
          안녕하세요, {user.name}님
        </h1>
        <p className="mt-1 text-[var(--color-gray-400)]">{villageLabel(user.village)}</p>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <HomeTile icon="📄" label="주보" href="/my/bulletin" />
          <HomeTile icon="📷" label="사진첩" href="/my/photos" />
          <HomeTile icon="📢" label="공지사항" href="/my/notices" />
          <HomeTile icon="⚙️" label="내 정보" href="/my/profile" />
          <HomeTile icon="🗂" label="월례회 자료" className="col-span-2" />
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
