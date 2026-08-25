import type { MetadataRoute } from "next";

/**
 * PWA 웹 앱 매니페스트 (FR-MEM-03 · NFR-COMP-06 · ARCHITECTURE.md §2.1 "PWA | manifest").
 *
 * Next 16 App Router의 `app/manifest.ts` 파일 컨벤션을 쓴다 — `/manifest.webmanifest`로
 * 서빙되고 `<link rel="manifest">`가 자동으로 붙는다. `public/manifest.json`을 손으로
 * 두지 않는 이유는 하나 더 있다: `public/photos/retreat-2026/manifest.json`(mock 사진
 * 메타)과 경로가 헷갈린다.
 *
 * `start_url`은 `/home`이다 (PM 결정 2026-08-25). 예전에는 `/my`였지만 공개 열람
 * 전환으로 `/my`가 로그인한 사람의 개인 화면이 되면서, 설치한 비회원이 앱을 열
 * 때마다 로그인 안내부터 보게 됐다. `/home`은 누구에게나 의미가 있다 —
 * 예배 시간·장소와 자료 진입이 한 화면에 있다.
 *
 * 색상은 globals.css 토큰과 같은 값을 쓴다. Tailwind 토큰을 빌드 시점에 읽을 수 없어
 * hex를 직접 적는 유일한 예외다 (CONVENTIONS.md §5의 "hex 박지 않는다"에 대한 예외 —
 * 매니페스트는 CSS가 아니라 브라우저 OS 통합용 메타데이터다).
 *   --background     #f6f1e4 (베이지)
 *   --color-yellow   #2f7a4a (브랜드 그린)
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LIGHT — 김해교회 청년교회",
    short_name: "LIGHT",
    description:
      "김해교회 청년교회 LIGHT. 주보·사진첩·공지를 홈 화면에서 바로 확인합니다.",
    lang: "ko",
    dir: "ltr",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f1e4",
    theme_color: "#f6f1e4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
