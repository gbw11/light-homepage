import { CHURCH_PHONE, CHURCH_PHONE_TEL } from "@/content/contact";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--color-navy-100)] px-5 py-10 text-sm text-[var(--color-gray-400)]">
      <p className="text-base font-bold text-[var(--foreground)]">LIGHT</p>
      <p className="mt-1">Live In God, Help The other</p>

      <div className="mt-4 space-y-1">
        <p>주일 14:00 · 드림센터 4층</p>
        <p>경남 김해시 가락로 117</p>
        {/* 텍스트로만 두면 모바일에서 눌러도 걸리지 않는다 (기기가 알아서 잡아주길 기대할 일이 아니다) */}
        <p>
          <a href={`tel:${CHURCH_PHONE_TEL}`} className="hover:underline">
            {CHURCH_PHONE}
          </a>
        </p>
      </div>

      {/* 링크 한 줄 — 본문 속 링크가 아니라 개별 타겟이므로 44px를 맞춘다 (NFR-A11Y-05) */}
      <nav aria-label="관련 링크" className="mt-4 flex flex-wrap gap-x-4">
        <a
          href="https://instagram.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center"
        >
          ▸ Instagram
        </a>
        <a
          href="https://youtube.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center"
        >
          ▸ YouTube
        </a>
        <a
          href="https://gimhae.church"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center"
        >
          ▸ 김해교회 홈페이지
        </a>
      </nav>

      <p className="mt-6 border-t border-[var(--color-navy-100)] pt-4">
        © 김해교회 청년교회 LIGHT
      </p>
    </footer>
  );
}
