import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { QueryProvider } from "@/components/providers/QueryProvider";

/**
 * ⚠️ 폰트: Pretendard를 `public/fonts/`에 self-host하고 `next/font/local`로
 *    교체할 예정이다 (frontend/README.md). 지금은 시스템 폰트 스택을 쓴다.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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

/** 검색엔진용 구조화 데이터 (SPEC_FUNCTIONAL.md FR-PUB-10) */
const CHURCH_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Church",
  name: "LIGHT — 김해교회 청년교회",
  url: SITE_URL,
  address: {
    "@type": "PostalAddress",
    streetAddress: "가락로 117",
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
        <QueryProvider>
          <Header />
          {children}
          <Footer />
        </QueryProvider>
      </body>
    </html>
  );
}
