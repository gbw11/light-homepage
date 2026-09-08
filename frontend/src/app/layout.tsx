import type { Metadata, Viewport } from "next";
import { VENUE } from "@/content/location";
import {
  FRIDAY_PRAYER_TIME,
  VILLAGE_END_TIME,
  YOUTH_SERVICE_LINE_PLAIN,
  YOUTH_SERVICE_TIME,
} from "@/content/worship";
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
    `김해교회 청년교회 LIGHT. 청년예배 ${YOUTH_SERVICE_LINE_PLAIN}. 20세~39세 또는 결혼 전 청년이면 누구나 환영합니다.`,
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
  /*
    카디널리티가 다중이라 배열이 유효하다. 전에는 객체 하나였고 `opens`만
    있었다 — 종료 시각이 없는 `OpeningHoursSpecification`은 검증 도구가 경고를
    내고, 일부 소비자는 "무제한 개방"으로 읽는다.

    ⚠️ **두 항목이 비대칭이다.** 주일에는 `closes`가 있고 금요일에는 없다.
       주일은 마을모임 종료(16:00)라는 근거 있는 종료 시각이 있지만, 금요기도회는
       주보에 종료 시각이 없다. 21:00쯤을 짐작해 넣는 것은 숫자를 지어내는
       것이다 — **비대칭이 조작보다 낫다.**

    ⚠️ **본당 1·2·3부(07:30·09:30·11:30)는 일부러 빠져 있다.** 이 노드의
       `address`는 드림센터(위 `address`)인데 본당 예배는 가락로 117에서 열린다.
       같은 노드에 넣으면 *"드림센터가 일요일 07:30에 연다"*는 사실과 다른
       구조화 데이터를 검색엔진에 먹인다. `location.ts`가 경고하는 본당·드림센터
       혼동을 기계 판독 데이터로 굳히는 셈이다. 본당은 사람이 읽는 `/worship`
       섹션에만 둔다 — 필요해지면 `parentOrganization`을 별도 노드로 세운다.

    후속 과제: 예배의 정확한 타입은 `Event` + `eventSchedule`이고 그쪽이라면
    "매달 둘째 주" 예외도 `byMonthWeek`로 표현할 수 있다. 다만 교회 예배 시간에
    대해 구글이 주는 리치 결과가 없어 **읽는 소비자가 없는 정밀도**다.
    `openingHoursSpecification`은 지도류 소비자가 읽으므로 지금은 여기서 멈춘다.
  */
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Sunday",
      opens: YOUTH_SERVICE_TIME,
      closes: VILLAGE_END_TIME,
      description: `청년예배 · ${VENUE}`,
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Friday",
      opens: FRIDAY_PRAYER_TIME,
      description: `금요기도회 · ${VENUE} (매달 둘째 주는 본당)`,
    },
  ],
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
