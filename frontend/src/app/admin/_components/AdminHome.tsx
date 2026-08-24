"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Section } from "@/components/ui/Section";
import { isPastor } from "@/components/auth/RequirePastor";
import type { Role } from "@/types/api";
import { PendingApprovalBanner } from "./PendingApprovalBanner";
import { StorageGauge } from "./StorageGauge";

/** WIREFRAME.md §15 — 역할 배지(`임원` / `전도사`)를 항상 표시한다 */
function roleBadgeLabel(role: Role): string {
  return role === "PASTOR" ? "전도사" : "임원";
}

type AdminLink = {
  label: string;
  /** 없으면 라우트가 아직 없는 항목 — `/my`의 "준비 중" 타일과 같은 처리 */
  href?: string;
  /** 전도사 전용 항목에 붙는 꼬리표 (WIREFRAME.md §15 "[전도사님만]") */
  note?: string;
};

/**
 * WIREFRAME.md §15의 그룹 구성을 그대로 옮긴다. 라우트가 없는 항목은
 * 목록에서 빼지 않고 **비활성으로 남긴다** — 관리 홈은 "이 사이트에서
 * 운영자가 할 수 있는 일 전체"를 보여주는 화면이라, 없는 기능이 조용히
 * 사라지면 "어디서 하는지 못 찾겠다"가 된다.
 */
const CONTENT_LINKS: AdminLink[] = [
  { label: "공지 작성", href: "/admin/posts/new" },
  { label: "주보 업로드", href: "/admin/bulletin/upload" },
  /*
    업로드는 앨범에 매달린 화면이라(`/admin/albums/[id]/upload`) 앨범을 고르지
    않고 바로 갈 수 없다. 그래서 사진첩으로 보낸다 — 거기서 앨범을 만들거나
    고른 뒤 [사진 올리기]로 들어간다.
  */
  { label: "앨범 만들기 / 사진 업로드", href: "/my/photos" },
  { label: "월례회 자료 업로드" },
];

/**
 * 회의록·예산안은 권한이 동일해(SPEC_FUNCTIONAL §7.1) 한 라우트의 탭 두
 * 개로 구현돼 있다 (`/my/documents` 주석 참고). 와이어프레임의 두 항목이
 * 같은 화면을 가리킨다.
 */
const DOCUMENT_LINKS: AdminLink[] = [
  { label: "회의록", href: "/my/documents" },
  { label: "예산안", href: "/my/documents" },
];

/**
 * ⚠️ 권한이 항목마다 다르다 (SPEC_API §8): 회원 관리(§8.1~§8.4)는 `T`,
 * 새가족 내역(§8.6)은 `L` 이상이다. 관리 홈 자체는 `L`이라 임원에게도
 * 회원 관리 링크가 보이는데, 눌러도 `RequirePastor`가 "권한이 없습니다"를
 * 보여준다 — 있는 줄도 모르게 숨기는 것보다 왜 안 되는지 보이는 쪽이 낫다
 * (`RequireLeader`가 리다이렉트 대신 설명 화면을 쓰는 것과 같은 판단).
 */
const MANAGE_LINKS: AdminLink[] = [
  { label: "회원 관리", href: "/admin/members", note: "전도사님만" },
  { label: "새가족 등록 내역", href: "/admin/newcomers" },
];

export function AdminHome() {
  const { user } = useAuth();

  // RequireLeader가 비로그인·승인대기·일반회원을 이미 걸러낸다.
  if (!user) return null;

  return (
    <Section>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/my"
            className="text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-navy-900)]"
          >
            ← 나의 LIGHT
          </Link>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">관리</h1>
        </div>
        <span className="shrink-0 rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-4 py-2 text-sm font-bold">
          {roleBadgeLabel(user.role)}
        </span>
      </div>

      <div className="mt-8 space-y-8">
        {/* 승인 대기 알림은 §8.1이 `T` 전용이라 전도사에게만 마운트한다 */}
        {isPastor(user.role) && <PendingApprovalBanner />}

        <div className="rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-5">
          <h2 className="mb-3 text-sm font-bold text-[var(--color-gray-400)]">저장 공간</h2>
          <StorageGauge />
        </div>

        <AdminLinkGroup title="콘텐츠" links={CONTENT_LINKS} />
        <AdminLinkGroup title="문서" links={DOCUMENT_LINKS} />
        <AdminLinkGroup title="관리" links={MANAGE_LINKS} />
      </div>
    </Section>
  );
}

function AdminLinkGroup({ title, links }: { title: string; links: AdminLink[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-[var(--color-gray-400)]">{title}</h2>
      <ul className="divide-y divide-[var(--color-navy-100)] border-y border-[var(--color-navy-100)]">
        {links.map((link) => (
          <li key={`${link.label}-${link.href ?? "soon"}`}>
            {link.href ? (
              <Link
                href={link.href}
                className="flex min-h-11 items-center justify-between gap-3 py-3 font-bold"
              >
                <span>▸ {link.label}</span>
                {link.note && (
                  <span className="shrink-0 text-xs font-bold text-[var(--color-gray-400)]">
                    [{link.note}]
                  </span>
                )}
              </Link>
            ) : (
              <p className="flex min-h-11 items-center justify-between gap-3 py-3 font-bold text-[var(--color-gray-400)]">
                <span>▸ {link.label}</span>
                <span className="shrink-0 text-xs font-bold">준비 중</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
