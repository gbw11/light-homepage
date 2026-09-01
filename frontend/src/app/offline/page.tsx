import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { RetryButton } from "./RetryButton";

export const metadata: Metadata = {
  title: "오프라인",
  description: "인터넷에 연결되어 있지 않습니다.",
  // 검색 결과에 "오프라인" 페이지가 뜨면 안 된다. `robots.ts`는 공개 영역을
  // allow 하므로 이 페이지에서 직접 막는다.
  robots: { index: false, follow: false },
};

/**
 * 서비스워커 오프라인 폴백 (FR-MEM-03).
 *
 * `public/sw.js`가 install 시점에 이 페이지를 미리 받아두고, 네트워크가 죽어서
 * 내비게이션이 실패하면 이걸 대신 보여준다. 이때 주소창의 URL은 원래 가려던
 * 주소 그대로 남는다 — 그래서 아래 "다시 시도"가 원래 주소를 다시 태운다.
 *
 * ⚠️ **회원 데이터를 넣지 않는다.** 이 HTML은 로그인 여부와 무관하게 캐시에
 *    남는 유일한 페이지라, 회원 이름 하나라도 렌더에 들어가면 로그아웃 후에도
 *    캐시에 남는다. 그래서 완전 정적이고 데이터 페칭이 없다.
 *
 * ⚠️ **JS와 이미지에 기대지 않는다.** 둘 다 실제로 오프라인에서 깨진다:
 *    · 클라이언트 청크가 캐시에 있을지 없을지 알 수 없다 — SW는 요청된 적
 *      있는 `/_next/static/**`만 캐싱하고, 오프라인 폴백은 정의상 "처음 보는
 *      페이지"다. [다시 시도]가 두 상태에서 다 동작하게 만든 방법은
 *      `RetryButton.tsx` 주석에 적었다.
 *    · `next/image`는 `/_next/image`로 요청되고 그 경로는 SW가 캐싱하지
 *      않는다 (회원 사진이 같은 경로를 쓴다). 이모지와 텍스트로만 만든다.
 */
export default function OfflinePage() {
  return (
    <main>
      <Section className="text-center">
        <div className="mx-auto max-w-sm space-y-6">
          <p className="text-5xl" aria-hidden="true">
            📡
          </p>
          <h1 className="text-xl font-bold">인터넷에 연결되어 있지 않습니다</h1>
          <p className="leading-relaxed text-[var(--color-gray-400)]">
            연결을 확인한 뒤 다시 시도해 주세요. 주보와 사진첩은 보안을 위해
            기기에 저장하지 않으므로 오프라인에서는 볼 수 없습니다.
          </p>
          <RetryButton />
        </div>
      </Section>
    </main>
  );
}
