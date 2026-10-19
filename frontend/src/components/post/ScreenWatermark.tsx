"use client";

import { useState, type ReactNode } from "react";
import type { AuthUser } from "@/types/api";

/** `2026-10-19 16:12` — 사용자 기기의 로컬 시간 */
function formatViewedAt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 워터마크 문구 — 월례회 서버 워터마크와 같은 내용: **이름 · 연락처 뒷4자리 · 열람 시각**.
 * 연락처 전체를 박지 않는다 — 누가 찍었는지 가릴 수 있으면 충분하고, 사진이 돌면
 * 그 사람 번호까지 같이 돈다.
 */
export function watermarkText(user: Pick<AuthUser, "name" | "phone">, viewedAt: Date): string {
  const last4 = user.phone.replace(/\D/g, "").slice(-4);
  return [user.name, last4, formatViewedAt(viewedAt)].filter(Boolean).join(" · ");
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** 사선 글자 한 칸을 SVG로 만들어 배경으로 반복한다 — 본문 길이와 무관하게 빈틈없이 덮는다 */
function tileUrl(text: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">` +
    `<text x="160" y="90" text-anchor="middle" dominant-baseline="middle" ` +
    `transform="rotate(-24 160 90)" font-family="sans-serif" font-size="15" fill="#000" fill-opacity="0.13">` +
    `${escapeXml(text)}</text></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

/**
 * 회의록·예산안 본문 위 화면 워터마크 (PM 결정 2026-10-19, 기획 3-1).
 *
 * ## 이건 보호가 아니라 억제다
 * 월례회는 서버가 **픽셀에 태워서** 보내고, FE는 CSS 오버레이를 일부러 만들지 않았다
 * (`MeetingViewer.tsx`, FR-MTG-03 — 개발자도구로 지워진다). 회의록·예산안 본문은
 * 서버가 그림이 아니라 **글(JSON)**로 주므로 태울 픽셀이 없다. 웹은 화면 캡처를
 * 막을 수 없어, 캡처한 화면에 **누가 언제 봤는지가 찍히게** 하는 것으로 억제한다.
 * 개발자도구로 지울 수 있다는 한계는 그대로다 — 그래서 화면에 "막았다"고 쓰지 않고
 * "열람자 정보가 표시된다"는 사실만 알린다.
 *
 * ## 본문 복사 끄기 (권장 항목)
 * `select-none` + `onCopy` 차단. 이것도 마찰일 뿐이다(소스 보기로 우회된다).
 *
 * 열람 시각은 **화면을 연 순간**으로 고정한다 — 렌더마다 바뀌면 캡처마다 다른 시각이
 * 찍혀 "언제 본 화면인가"를 흐린다.
 */
export function ScreenWatermark({
  user,
  children,
}: {
  user: Pick<AuthUser, "name" | "phone">;
  children: ReactNode;
}) {
  const [viewedAt] = useState(() => new Date());
  const text = watermarkText(user, viewedAt);

  return (
    <div className="relative">
      <div
        className="select-none"
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        data-watermark={text}
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: tileUrl(text), backgroundRepeat: "repeat" }}
      />
      <p className="mt-6 text-xs text-[var(--color-gray-400)]">
        이 화면에는 열람자 정보(이름·연락처 뒷자리·열람 시각)가 표시됩니다.
      </p>
    </div>
  );
}
