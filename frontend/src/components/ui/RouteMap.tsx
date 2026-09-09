/**
 * 약도 두 장 — 본당에서 걸어오는 길(`RouteMap`)과 주차장 세 곳에서 오는
 * 길(`ParkingMap`). WIREFRAME.md §8 · PLAN.md §8 "길찾기 사진 3장" 중 약도.
 *
 * **왜 SVG를 직접 그리는가.** 카카오맵·네이버지도의 지도 화면은 라이선스가
 * 있어서 공개 사이트에 스크린샷으로 올릴 수 없다. 지도 JS SDK는 API 키·로딩
 * 비용 때문에 `WIREFRAME.md §8`이 Phase 3로 미뤄뒀고, `COST_GUARDRAILS.md §2`
 * 표에도 지도 서비스가 없다. 남는 방법이 **직접 그린 약도**이고, §8이 애초에
 * 채택해둔 "이미지 + 외부 앱 링크"가 정확히 이것이다.
 *
 * **좌표를 지어내지 않았다.** 두 곳에서 확인한 값으로만 그렸다.
 *
 * 카카오맵 (2026-09-04):
 * - 본당 김해교회 — 경남 김해시 가락로 117 (지번 서상동 177-4)
 * - 드림센터 — 경남 김해시 분성로317번길 31 (지번 서상동 164-1), 우 50916
 * - 도보 — 남쪽 95m → 오른쪽(서쪽) 39m → 도착. **총 134m, 2분**
 *   (큰길·최단·편안한길 3안이 모두 같다 = 갈림길이 없다)
 *
 * 모교회 공식 안내 (https://www.gloria.or.kr/general-5 주차 약도,
 * https://www.gloria.or.kr/교회-안내 배치도):
 * - 주차장 세 곳의 위치 — 1주차장은 본당 동쪽 건너편, 3주차장(합성초)은
 *   학교 안 남쪽으로 드림센터에 붙어 있고, 2주차장(농협)은 드림센터 남동쪽
 * - 배치도가 드림센터를 "합성초 맞은편 / 약 100m"로 적어둔 것도 위 실측과 맞는다
 *
 * 랜드마크로 학교를 쓴 이유: 모퉁이에 카페가 하나 있지만 **상호는 바뀐다.**
 * 학교는 안 바뀌고, 처음 오는 사람이 멀리서도 알아본다.
 *
 * 이 그림들은 **축척이 아니라 순서**를 보여준다 — 실제 비율보다 여백을 넉넉히
 * 뒀다. 글자가 겹치면 약도의 목적을 잃는다.
 *
 * 색은 전부 토큰이라 다크 모드에서 함께 뒤집힌다 (`globals.css`).
 */

/** 본당→드림센터 도보 실측값. 화면 문구가 함께 쓴다 */
export const WALK_SUMMARY = "도보 2분 · 134m";

/**
 * 두 약도가 공유하는 바닥 — 길 두 개, 학교, 드림센터.
 *
 * 길과 학교는 `--color-gray-400`을 옅게 깐다. 처음엔 `--color-navy-100`을
 * 썼는데 담는 `<figure>` 배경이 같은 토큰이라 길이 통째로 사라졌다.
 * 배경색과 다른 축을 쓰되 짙기만 낮추면 라이트·다크 양쪽에서 함께 산다.
 */
function MapBase({
  titleY,
  floorY,
  labelX = 140,
}: {
  titleY: number;
  floorY: number;
  /**
   * 이름표의 가로 위치. 기본값은 도착 원 바로 위다.
   * 주차 약도만 왼쪽으로 민다 — 거기서는 P3에서 내려오는 점선이
   * 이름표 오른쪽 끝을 가로질렀다.
   */
  labelX?: number;
}) {
  return (
    <>
      <g stroke="var(--color-gray-400)" strokeWidth="26" strokeLinecap="round" fill="none" opacity="0.28">
        <path d="M250 60 V248" />
        <path d="M84 248 H316" />
      </g>

      {/* 김해합성초등학교 — 걷는 내내 옆에 보이는 기준점 */}
      <rect x="62" y="86" width="146" height="104" rx="10" fill="var(--color-gray-400)" opacity="0.13" />

      {/* 도로명 — 오른쪽으로 꺾어 드는 그 길이 가락로다 */}
      <text x="318" y="274" textAnchor="middle" fontSize="16" fill="var(--color-gray-400)">
        가락로
      </text>

      {/*
        도착만 노란 강조 원이다. 이 약도를 보는 사람은 드림센터를 찾고 있고,
        "4층"은 여기서 가장 자주 놓치는 정보다 (그래서 두 화면 모두 빨간
        경고 블록으로 한 번 더 말한다). 4층은 원 아래에 뗀다 — 위에 붙이면
        별 표시와 겹친다.
      */}
      <circle cx="140" cy="248" r="17" fill="var(--color-yellow)" />
      <text x="140" y="255" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--color-accent-fg)">
        ★
      </text>
      {/*
        두 줄의 y를 각각 받는다. 붙여놓고 오프셋으로 계산했더니 도보 약도에서
        "4층"이 도로 띠 위(y=235)로 올라가 겹쳤다 — 두 약도가 주변에 두는
        것이 달라서, 한쪽에 맞춘 간격이 다른 쪽에서 깨진다.
      */}
      <text x={labelX} y={titleY} textAnchor="middle" fontSize="21" fontWeight="700" fill="var(--color-ink)">
        드림센터
      </text>
      <text x={labelX} y={floorY} textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--color-red-500)">
        4층
      </text>

      {/* 북쪽 표시 — 종이 약도를 실제 방향에 맞춰 돌려볼 수 있어야 한다 */}
      <g transform="translate(34 40)">
        <path d="M0 14 L7 -6 L14 14 L7 8 Z" fill="var(--color-gray-400)" />
        <text x="7" y="34" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-gray-400)">
          N
        </text>
      </g>
    </>
  );
}

const WALK_TITLE = "route-map-title";
const WALK_DESC = "route-map-desc";

/** 본당 → 드림센터. `/welcome`과 `/location`이 함께 쓴다 */
export function RouteMap({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 360" className={className} role="img" aria-labelledby={`${WALK_TITLE} ${WALK_DESC}`}>
      <title id={WALK_TITLE}>본당에서 드림센터까지 가는 약도</title>
      {/*
        스크린 리더는 그림 대신 이 문장을 읽는다. 약도가 전하려는 것을 문장
        하나로 옮긴 것이라, 그림을 볼 수 없어도 길을 찾을 수 있어야 한다.
      */}
      <desc id={WALK_DESC}>
        김해교회 본당 앞에서 남쪽으로 95미터 내려가면 김해합성초등학교 남쪽
        모퉁이가 나옵니다. 거기서 오른쪽(서쪽)으로 가락로를 따라 39미터 가면
        왼편이 드림센터입니다. 청년예배는 4층입니다. 전체 134미터, 도보 2분입니다.
      </desc>

      <MapBase titleY={212} floorY={292} />

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

      <text x="272" y="166" fontSize="18" fontWeight="700" fill="var(--color-red-500)">
        95m
      </text>
      {/* 도로 띠 위쪽 가장자리가 y=235다. 글자 밑선을 거기 붙이면 닿아 보인다 */}
      <text x="204" y="228" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--color-red-500)">
        39m
      </text>

      <circle cx="250" cy="60" r="13" fill="var(--color-gray-400)" />
      <text x="272" y="50" fontSize="20" fontWeight="700" fill="var(--color-ink)">
        본당
      </text>
      <text x="272" y="72" fontSize="16" fill="var(--color-gray-400)">
        김해교회
      </text>

      <text x="180" y="342" textAnchor="middle" fontSize="19" fontWeight="700" fill="var(--color-ink)">
        {WALK_SUMMARY}
      </text>
    </svg>
  );
}

const PARK_TITLE = "parking-map-title";
const PARK_DESC = "parking-map-desc";

/**
 * 주차장 세 곳의 위치와 각각에서 드림센터로 걷는 길.
 *
 * 번호(P1·P2·P3)는 **교회 공식 안내의 1·2·3주차장 그대로**다. 우리가 다시
 * 매기면 교회 안내문과 이 화면을 나란히 보는 사람이 헷갈린다 — 가장 가까운
 * 3주차장을 1번으로 바꾸고 싶은 유혹이 있었지만 그래서 두지 않았다.
 */
export function ParkingMap({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 360" className={className} role="img" aria-labelledby={`${PARK_TITLE} ${PARK_DESC}`}>
      <title id={PARK_TITLE}>주차장 세 곳에서 드림센터로 가는 약도</title>
      <desc id={PARK_DESC}>
        드림센터에 가장 가까운 곳은 3주차장(합성초 주차장)으로, 김해합성초등학교
        안 남쪽에 있어 바로 내려오면 됩니다. 2주차장(농협 주차장)은 드림센터
        남동쪽으로 가락로를 따라 서쪽으로 걸어옵니다. 1주차장(교회 건너편
        주차장)은 본당 맞은편이라, 본당에서 걸어오는 길과 같게 남쪽으로 내려온 뒤
        오른쪽으로 꺾습니다. 청년예배는 드림센터 4층입니다.
      </desc>

      <MapBase titleY={214} floorY={292} labelX={104} />

      {/*
        이름표는 **P2에만** 단다.
        - P1은 본당 상자 바로 건너편에 그려서 "교회 건너편"이 위치로 읽힌다
        - P3은 학교 블록 안에 있어 "합성초"를 또 쓰면 학교 이름표와 겹치고
          같은 말을 두 번 하는 셈이다
        - P2만 아무 것도 붙어 있지 않은 자리에 떠 있어서, 번호만 보면
          어디인지 알 수 없다

        셋 다 붙였던 처음 판에서는 이름표가 본당·학교 이름표와 차례로 겹쳤다.
        정사각 한 장에 들어갈 글자 수는 정해져 있고, 나머지 이름은 바로 아래
        목록이 말해준다.
      */}
      <text x="105" y="116" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--color-gray-400)">
        김해합성
      </text>
      <text x="105" y="138" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--color-gray-400)">
        초등학교
      </text>

      {/* 세 갈래 경로. 도착점이 같아 선이 만나므로 굵기를 얇게 잡았다 */}
      <g
        fill="none"
        stroke="var(--color-red-500)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="10 8"
      >
        {/* P1 — 길을 건너 본당 쪽으로 온 뒤, 본당에서 걷는 길을 그대로 탄다 */}
        <path d="M272 61 H250 V248 H140" />
        {/* P3 — 학교 안에서 바로 내려온다. 세 곳 중 가장 짧다 */}
        <path d="M176 174 V248 H140" />
        {/* P2 — 가락로 남쪽에서 비스듬히 올라붙는다 */}
        <path d="M232 303 H196 L162 264" />
      </g>

      {/* 본당은 위치를 알려주는 역할만 한다 — 여기서는 출발점이 아니다 */}
      <rect x="196" y="44" width="52" height="34" rx="7" fill="var(--color-gray-400)" opacity="0.22" />
      <text x="222" y="66" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--color-gray-400)">
        본당
      </text>

      {/* 1주차장 — 본당 건너편. 도로를 사이에 두고 본당 반대편에 그린다 */}
      <ParkingBox x={272} y={44} label="P1" />
      {/* 3주차장 — 학교 안 남쪽. 드림센터에 가장 가깝다 */}
      <ParkingBox x={150} y={140} label="P3" />
      {/* 2주차장 — 드림센터 남동쪽, 가락로 건너. 여기만 이름표가 필요하다 */}
      <ParkingBox x={232} y={286} label="P2" />
      <text x="258" y="340" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--color-gray-400)">
        농협주차장
      </text>
    </svg>
  );
}

/** 주차장 한 칸. 좌표는 상자의 왼쪽 위 모서리다 */
function ParkingBox({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="52"
        height="34"
        rx="7"
        fill="var(--color-gray-400)"
        opacity="0.22"
        stroke="var(--color-gray-400)"
        strokeWidth="1.5"
      />
      <text
        x={x + 26}
        y={y + 24}
        textAnchor="middle"
        fontSize="19"
        fontWeight="700"
        fill="var(--color-ink)"
      >
        {label}
      </text>
    </g>
  );
}
