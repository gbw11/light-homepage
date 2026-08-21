import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
