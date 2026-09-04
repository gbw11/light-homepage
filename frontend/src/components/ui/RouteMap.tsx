/**
 * 본당 ↔ 드림센터 약도 (WIREFRAME.md §8 · PLAN.md §8 "길찾기 사진 3장" 중 1장).
 *
 * **왜 SVG를 직접 그리는가.** 카카오맵·네이버지도의 지도 화면은 라이선스가
 * 있어서 공개 사이트에 스크린샷으로 올릴 수 없다. 지도 JS SDK는 API 키·로딩
 * 비용 때문에 `WIREFRAME.md §8`이 Phase 3로 미뤄뒀고, `COST_GUARDRAILS.md §2`
 * 표에도 지도 서비스가 없다. 남는 방법이 **직접 그린 약도**이고, §8이 애초에
 * 채택해둔 "이미지 + 외부 앱 링크"가 정확히 이것이다.
 *
 * **좌표를 지어내지 않았다.** 2026-09-04에 카카오맵에서 실제로 확인한 값이다:
 *
 * - 본당 김해교회 — 경남 김해시 가락로 117 (지번 서상동 177-4)
 * - 드림센터 — 경남 김해시 분성로317번길 31 (지번 서상동 164-1), 우 50916
 * - 도보 경로 — 남쪽 95m 이동 → 오른쪽(서쪽) 39m 이동 → 도착.
 *   **총 134m, 도보 2분** (카카오맵 도보 길찾기, 큰길·최단·편안한길 3안 모두 동일)
 * - 두 건물 사이에 김해합성초등학교가 있고, 걷는 길이 그 학교 동쪽 담을 따른다
 *
 * 랜드마크로 학교를 쓴 이유: 모퉁이에 카페가 하나 있지만 **상호는 바뀐다.**
 * 학교는 안 바뀌고, 처음 오는 사람이 멀리서도 알아본다.
 *
 * 이 그림은 **축척이 아니라 순서**를 보여준다 — 실제 95m:39m 비율보다 가로를
 * 넉넉히 뒀다. 글자가 겹치면 약도의 목적을 잃는다.
 *
 * 색은 전부 토큰이라 다크 모드에서 함께 뒤집힌다 (`globals.css`).
 */

const TITLE_ID = "route-map-title";
const DESC_ID = "route-map-desc";

/** 본당→드림센터 도보 실측값. 화면 문구와 `content/location.ts`가 함께 쓴다. */
export const WALK_SUMMARY = "도보 2분 · 134m";

export function RouteMap({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 360"
      className={className}
      role="img"
      aria-labelledby={`${TITLE_ID} ${DESC_ID}`}
    >
      <title id={TITLE_ID}>본당에서 드림센터까지 가는 약도</title>
      {/*
        스크린 리더는 그림 대신 이 문장을 읽는다. 약도가 전하려는 것을 문장
        하나로 옮긴 것이라, 그림을 볼 수 없어도 길을 찾을 수 있어야 한다.
      */}
      <desc id={DESC_ID}>
        김해교회 본당 앞에서 남쪽으로 95미터 내려가면 김해합성초등학교 남쪽
        모퉁이가 나옵니다. 거기서 오른쪽(서쪽)으로 가락로를 따라 39미터 가면
        왼편이 드림센터입니다. 청년예배는 4층입니다. 전체 134미터, 도보 2분입니다.
      </desc>

      {/*
        길과 학교는 `--color-gray-400`을 옅게 깐다. 처음엔 `--color-navy-100`을
        썼는데 담는 `<figure>` 배경이 같은 토큰이라 길이 통째로 사라졌다.
        배경색과 다른 축을 쓰되 짙기만 낮추면 라이트·다크 양쪽에서 함께 산다.
      */}
      <g stroke="var(--color-gray-400)" strokeWidth="26" strokeLinecap="round" fill="none" opacity="0.28">
        <path d="M250 60 V248" />
        <path d="M84 248 H316" />
      </g>

      {/* 김해합성초등학교 — 걷는 내내 왼쪽에 보이는 기준점 */}
      <rect x="62" y="86" width="146" height="104" rx="10" fill="var(--color-gray-400)" opacity="0.13" />
      <text x="135" y="132" textAnchor="middle" fontSize="19" fontWeight="700" fill="var(--color-gray-400)">
        김해합성
      </text>
      <text x="135" y="158" textAnchor="middle" fontSize="19" fontWeight="700" fill="var(--color-gray-400)">
        초등학교
      </text>

      {/* 걷는 경로 — 점선이 "이렇게 가라"는 뜻을 가장 적은 잉크로 말한다 */}
      <path
        d="M250 60 V248 H140"
        fill="none"
        stroke="var(--color-red-500)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="11 9"
      />

      {/* 구간 거리 */}
      <text x="272" y="166" fontSize="18" fontWeight="700" fill="var(--color-red-500)">
        95m
      </text>
      {/* 도로 띠 위쪽 가장자리가 y=235다. 글자 밑선을 거기 붙이면 닿아 보인다 */}
      <text x="204" y="228" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--color-red-500)">
        39m
      </text>

      {/* 도로명 — 오른쪽으로 꺾어 드는 그 길이 가락로다 */}
      <text x="318" y="274" textAnchor="middle" fontSize="16" fill="var(--color-gray-400)">
        가락로
      </text>

      {/* 출발 — 본당 */}
      <circle cx="250" cy="60" r="13" fill="var(--color-gray-400)" />
      <text x="272" y="50" fontSize="20" fontWeight="700" fill="var(--color-ink)">
        본당
      </text>
      <text x="272" y="72" fontSize="16" fill="var(--color-gray-400)">
        김해교회
      </text>

      {/*
        도착만 노란 강조 원이다. 이 약도를 보는 사람은 본당이 아니라
        드림센터를 찾고 있고, "4층"은 여기서 가장 자주 놓치는 정보다
        (그래서 두 화면 모두 빨간 경고 블록으로 한 번 더 말한다).
        4층은 원 아래에 뗀다 — 위에 붙이면 별 표시와 겹친다.
      */}
      <circle cx="140" cy="248" r="17" fill="var(--color-yellow)" />
      <text x="140" y="255" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--color-accent-fg)">
        ★
      </text>
      <text x="140" y="212" textAnchor="middle" fontSize="21" fontWeight="700" fill="var(--color-ink)">
        드림센터
      </text>
      <text x="140" y="292" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--color-red-500)">
        4층
      </text>

      {/* 북쪽 표시 — 종이 약도를 실제 방향에 맞춰 돌려볼 수 있어야 한다 */}
      <g transform="translate(34 40)">
        <path d="M0 14 L7 -6 L14 14 L7 8 Z" fill="var(--color-gray-400)" />
        <text x="7" y="34" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-gray-400)">
          N
        </text>
      </g>

      <text x="180" y="342" textAnchor="middle" fontSize="19" fontWeight="700" fill="var(--color-ink)">
        {WALK_SUMMARY}
      </text>
    </svg>
  );
}
