import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteRails } from "@/components/layout/SiteRails";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { SITE_URL } from "@/lib/site";

/**
 * ⚠️ 폰트: Pretendard를 `public/fonts/`에 self-host하고 `next/font/local`로
 *    교체할 예정이다 (frontend/README.md). 지금은 시스템 폰트 스택을 쓴다.
 */


export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LIGHT — 김해교회 청년교회",
    template: "%s · LIGHT",
  },
  description:
    "김해교회 청년교회 LIGHT. 청년예배 주일 14:00 드림센터 4층. 20세~39세 또는 결혼 전 청년이면 누구나 환영합니다.",
  openGraph: {
    type: "website",
    siteName: "LIGHT — 김해교회 청년교회",
    locale: "ko_KR",
    url: SITE_URL,
  },
};

/**
 * PWA 설치 시 OS 표시줄 색. `app/manifest.ts`의 `theme_color`와 같은 값을 유지한다
 * (globals.css `--background` 베이지 / 다크 모드 웜톤).
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e5e0d8" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1a12" },
  ],
};

/** 검색엔진용 구조화 데이터 (SPEC_FUNCTIONAL.md FR-PUB-10) */
const CHURCH_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Church",
  name: "LIGHT — 김해교회 청년교회",
  url: SITE_URL,
  address: {
    "@type": "PostalAddress",
    streetAddress: "분성로317번길 31",
    addressLocality: "김해시",
    addressRegion: "경남",
    addressCountry: "KR",
  },
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: "Sunday",
    opens: "14:00",
    description: "청년예배 · 드림센터 4층",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(CHURCH_JSON_LD) }}
        />
        {/*
          건너뛰기 링크 — 키보드 사용자가 헤더를 매 페이지마다 훑지 않게 한다
          (SPEC_NONFUNCTIONAL.md §6 NFR-A11Y-06). 각 페이지의 `<main>`이
          `id="main"`을 갖는다. 평소엔 sr-only, 포커스를 받으면 좌상단에 뜬다.
        */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-[var(--radius-button)] focus:bg-[var(--color-navy-900)] focus:px-4 focus:text-base focus:font-bold focus:text-white"
        >
          본문으로 바로가기
        </a>
        <QueryProvider>
          <AuthProvider>
            <ServiceWorkerRegistrar />
            <Header />
            <SiteRails />
            {children}
            <SiteFooter />
            <InstallBanner />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
