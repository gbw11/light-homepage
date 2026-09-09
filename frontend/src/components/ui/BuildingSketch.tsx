/**
 * 드림센터 건물 그림 — "이 건물입니다" 자리 (WIREFRAME.md §2 · §8).
 *
 * **왜 사진이 아니라 그림인가.** 사진이 없다. 모교회 홈페이지에도 건물 사진이
 * 없고(2026-09-04 확인), 로드뷰 캡처는 쓸 수 없다 — 카카오·네이버 로드뷰
 * 이미지는 라이선스가 있어서 공개 사이트에 올리면 약관 위반이고, 화면에 찍힌
 * **차량 번호판**도 그대로 공개된다. 지도 스크린샷을 안 쓰기로 한 것과 같은
 * 이유다 (`RouteMap.tsx` 주석 · DECISIONS 2026-09-04).
 *
 * 그래서 **로드뷰를 보고 직접 그렸다.** 확인한 특징:
 *
 * - 지상 4층, **노출 콘크리트** 마감 (거푸집 자국이 그대로 남은 밝은 회색)
 * - 창은 세로로 긴 검은 새시, 한 짝이 여러 칸으로 나뉜다
 * - 옥상에 계단·엘리베이터 탑옥이 왼쪽으로 솟아 있고, 그 아래로 **살대 차양**이
 *   지나간다 — 멀리서 이 건물을 알아보게 하는 가장 뚜렷한 특징이다
 * - **분성로317번길 모퉁이**에 서 있고 건물 앞이 주차 공간이다
 *
 * **사진보다 나은 점이 하나 있다.** 4층과 입구를 강조할 수 있다. 이 그림을
 * 보는 사람이 실제로 헤매는 지점이 그 둘이고, 사진은 그걸 가리켜주지 못한다.
 *
 * ⚠️ 이건 어디까지나 **대역**이다. 실물 사진을 찍어 오면 이 그림을 치운다.
 *
 * 색은 전부 토큰이라 다크 모드에서 함께 뒤집힌다 (`globals.css`).
 */

const TITLE_ID = "building-sketch-title";
const DESC_ID = "building-sketch-desc";

/** 층 경계 y좌표. 위가 4층이다 */
const FLOORS = [
  { label: "4F", top: 90, isVenue: true },
  { label: "3F", top: 138, isVenue: false },
  { label: "2F", top: 186, isVenue: false },
  { label: "1F", top: 234, isVenue: false },
];

const FLOOR_H = 48;
/** 한 층에 창을 세 벌 그린다. x는 창 왼쪽 끝 */
const WINDOW_X = [82, 152, 222];
const WINDOW_W = 56;

export function BuildingSketch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 360" className={className} role="img" aria-labelledby={`${TITLE_ID} ${DESC_ID}`}>
      <title id={TITLE_ID}>드림센터 건물 그림</title>
      <desc id={DESC_ID}>
        드림센터는 지상 4층짜리 노출 콘크리트 건물입니다. 밝은 회색 콘크리트 벽에
        세로로 긴 검은 창이 규칙적으로 나 있고, 옥상 왼쪽에 계단탑이 솟아 있습니다.
        분성로317번길 모퉁이에 있고 건물 앞은 주차 공간입니다. 1층 가운데 입구로
        들어와 4층으로 올라오시면 청년예배 장소입니다.
      </desc>

      {/* 옥상 탑옥 — 계단·엘리베이터. 멀리서 이 건물을 찍어주는 표식이다 */}
      <rect x="70" y="50" width="46" height="40" fill="var(--color-gray-400)" opacity="0.18" />
      <rect
        x="70"
        y="50"
        width="46"
        height="40"
        fill="none"
        stroke="var(--color-gray-400)"
        strokeWidth="1.5"
        opacity="0.5"
      />

      {/* 살대 차양 — 탑옥 아래를 가로지른다 */}
      <rect x="60" y="76" width="240" height="14" fill="var(--color-gray-400)" opacity="0.26" />
      <g stroke="var(--color-gray-400)" strokeWidth="1.5" opacity="0.55">
        {Array.from({ length: 15 }, (_, i) => 66 + i * 16).map((x) => (
          <line key={x} x1={x} y1="76" x2={x} y2="90" />
        ))}
      </g>

      {/* 건물 몸통 — 노출 콘크리트 */}
      <rect x="60" y="90" width="240" height="190" fill="var(--color-gray-400)" opacity="0.16" />
      <rect
        x="60"
        y="90"
        width="240"
        height="190"
        fill="none"
        stroke="var(--color-gray-400)"
        strokeWidth="1.5"
        opacity="0.55"
      />

      {/* 층 경계선 */}
      <g stroke="var(--color-gray-400)" strokeWidth="1" opacity="0.35">
        {FLOORS.slice(1).map((f) => (
          <line key={f.label} x1="60" y1={f.top} x2="300" y2={f.top} />
        ))}
      </g>

      {FLOORS.map((floor) =>
        WINDOW_X.map((x) => {
          // 1층 가운데는 창이 아니라 입구다
          const isEntrance = floor.label === "1F" && x === 152;
          if (isEntrance) return null;
          const y = floor.top + 10;
          const h = FLOOR_H - 20;
          return (
            <g key={`${floor.label}-${x}`}>
              <rect x={x} y={y} width={WINDOW_W} height={h} fill="var(--color-gray-400)" opacity="0.7" />
              {/* 새시 가로대 두 개 — 한 짝이 여러 칸으로 나뉜 것이 이 건물 창의 인상이다 */}
              <line
                x1={x + WINDOW_W / 3}
                y1={y}
                x2={x + WINDOW_W / 3}
                y2={y + h}
                stroke="var(--color-navy-100)"
                strokeWidth="1.5"
              />
              <line
                x1={x + (WINDOW_W * 2) / 3}
                y1={y}
                x2={x + (WINDOW_W * 2) / 3}
                y2={y + h}
                stroke="var(--color-navy-100)"
                strokeWidth="1.5"
              />
            </g>
          );
        }),
      )}

      {/* 입구 — 1층 가운데. 노란색은 이 화면에서 "여기로 가라"는 뜻으로만 쓴다 */}
      <rect x="152" y="246" width="56" height="34" fill="var(--color-yellow)" />
      <text
        x="180"
        y="269"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="var(--color-accent-fg)"
      >
        입구
      </text>

      {/* 4층 표식 — 이 그림이 존재하는 이유의 절반이다 */}
      <circle cx="316" cy="114" r="16" fill="var(--color-yellow)" />
      <text
        x="316"
        y="120"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="var(--color-accent-fg)"
      >
        4F
      </text>
      <g stroke="var(--color-red-500)" strokeWidth="3" strokeLinecap="round">
        <line x1="296" y1="114" x2="306" y2="114" />
      </g>

      {/* 나머지 층 번호 */}
      {FLOORS.filter((f) => !f.isVenue).map((f) => (
        <text
          key={f.label}
          x="316"
          y={f.top + FLOOR_H / 2 + 5}
          textAnchor="middle"
          fontSize="14"
          fill="var(--color-gray-400)"
        >
          {f.label}
        </text>
      ))}

      {/* 땅 — 건물 앞은 주차 공간이다 */}
      <line x1="24" y1="280" x2="336" y2="280" stroke="var(--color-gray-400)" strokeWidth="2.5" opacity="0.5" />

      <text x="180" y="308" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--color-ink)">
        노출 콘크리트 4층 건물
      </text>
      <text x="180" y="332" textAnchor="middle" fontSize="15" fill="var(--color-gray-400)">
        분성로317번길 모퉁이 · 건물 앞이 주차 공간
      </text>
    </svg>
  );
}
