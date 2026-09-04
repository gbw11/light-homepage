import { CHURCH_PHONE, CHURCH_PHONE_TEL } from "@/content/contact";
import { CHURCH_SITE_URL, INSTAGRAM_URL, YOUTUBE_CHANNEL_URL } from "@/content/links";

/**
 * 공통 푸터.
 *
 * ## 뼈대를 모교회 사이트에 맞춘다 (PM 요청 2026-09-01)
 *
 * 김해교회(`gloria.or.kr`)의 푸터는 **어두운 띠 · 가운데 정렬 워드마크 ·
 * 구분자(`|`)로 이은 연락처 한 줄 · 저작권 한 줄**이다. 헤더와 같은 띠 색으로
 * 위아래를 닫아 페이지가 어디서 끝나는지 분명해진다.
 *
 * 색은 우리 팔레트를 쓴다 (`--color-navy-900`) — 뼈대를 맞추는 것과 색을
 * 베끼는 것은 다른 일이다 (`Header` 주석과 같은 판단).
 *
 * ## 좁은 화면에서는 줄을 쌓는다
 *
 * 저쪽은 한 줄에 `주소 | 이메일 | Tel | Fax`를 다 넣는데, 모바일에서 그러면
 * 글자가 잘리거나 구분자만 남은 줄이 생긴다. `flex-wrap`으로 자연스럽게
 * 접히게 두고 구분자는 **선(`border`)이 아니라 문자**로 두지 않는다 —
 * 줄바꿈 위치에 `|`가 홀로 남지 않게 하려면 요소 사이 여백으로 나누는 편이 낫다.
 */
export function Footer() {
  return (
    <footer className="mt-auto bg-[var(--color-navy-900)] px-5 py-10 text-center text-sm text-white/80">
      <div className="mx-auto w-full max-w-[var(--container-max)]">
        {/* 헤더 워드마크와 같은 토큰 — 그쪽 주석 참고 (PM 2026-09-02) */}
        <p className="text-lg font-bold text-[var(--color-accent-on-dark)]">LIGHT</p>
        <p className="mt-1 text-white/70">Live In God, Help The other</p>

        {/*
          연락처 한 줄 — 모교회 푸터와 같은 구성.
          전화는 링크로 둔다: 텍스트로만 두면 모바일에서 눌러도 걸리지 않는다.
        */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <span>주일 14:00 · 드림센터 4층</span>
          <span>경남 김해시 가락로 117</span>
          {/*
            ⚠️ 아래 링크 줄과 같은 이유로 44px를 맞춘다 (NFR-A11Y-05).
            이 줄은 텍스트(`span`) 사이에 링크가 하나 섞인 모양이라 높이를
            글자에 맡겨 20px였다 — **전화를 거는 링크가 모바일에서 가장 누르기
            어려운 타겟이었다.**
          */}
          <a
            href={`tel:${CHURCH_PHONE_TEL}`}
            className="inline-flex min-h-11 items-center hover:underline"
          >
            Tel: {CHURCH_PHONE}
          </a>
        </div>

        {/*
          링크 한 줄 — 본문 속 링크가 아니라 개별 타겟이므로 44px를 맞춘다

          ⚠️ 앞의 기호는 `▸`(단순 화살표)에서 **각 목적지를 나타내는 이모지**로
          바꿨다 (PM 요청 2026-09-02) — 세 링크가 나란히 있어 화살표만으로는
          어디로 가는지 글자를 읽어야 알 수 있었다. `aria-hidden`으로 감싸
          스크린리더에는 이모지가 읽히지 않고 링크 글자만 남는다.
          (NFR-A11Y-05). 주소를 모르는 항목은 **아예 그리지 않는다**
          (`content/links.ts` 주석) — 없는 계정으로 보내면 누른 사람이 빈손으로
          돌아온다. 김해교회 홈페이지는 2026-09-01에 주소가 확정되어 살아났다.
        */}
        <nav
          aria-label="관련 링크"
          className="mt-3 flex flex-wrap items-center justify-center gap-x-5"
        >
          <a
            href={YOUTUBE_CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 hover:underline"
          >
            <span aria-hidden>▶️</span> YouTube
          </a>
          {INSTAGRAM_URL && (
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 hover:underline"
            >
              <span aria-hidden>📷</span> Instagram
            </a>
          )}
          {CHURCH_SITE_URL && (
            <a
              href={CHURCH_SITE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 hover:underline"
            >
              <span aria-hidden>⛪</span> 김해교회 홈페이지
            </a>
          )}
        </nav>

        <p className="mt-4 border-t border-white/15 pt-4 text-white/60">
          © 2026 김해교회 청년교회 LIGHT
        </p>
      </div>
    </footer>
  );
}
