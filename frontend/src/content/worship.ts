/**
 * 예배·모임 시간의 **단일 출처**.
 *
 * `주일 14:00 · 드림센터 4층`이 화면 9곳과 metadata 6곳에 각자 하드코딩되어
 * 있었다. `app/worship/page.tsx`가 스스로 "출처를 하나로 만든다"고 적어뒀지만
 * 사실이 아니었다 — 같은 사고가 `links.ts`(유튜브 주소 두 값)·`location.ts`
 * (지도 링크 두 벌)에서 이미 났고, 이번이 세 번째다.
 *
 * 출처: **실제 LIGHT 주보 2026-08-23 (YEAR 2026 · ISSUE 34)**.
 * 본당 1·2·3부와 금요기도회는 그 주보에서 처음 확보한 값이다.
 *
 * ## 구조
 *
 * 3층으로 쌓는다. 위층은 아래층에서만 파생되므로 값이 갈라질 수 없다.
 *
 * 1. **원자** — `24시간 HH:mm` 문자열. JSON-LD `opens`가 이 형식을 요구한다
 * 2. **문구** — 화면·metadata에 그대로 들어가는 완성 문자열
 * 3. **표** — `/worship`이 그리는 행 배열
 *
 * ## 주의
 *
 * ⚠️ **server-only import를 넣지 말 것.** `components/layout/Header.tsx`가
 *    클라이언트 컴포넌트인데 이 파일을 쓴다. 순수 문자열·함수만 둔다.
 *
 * ⚠️ **`mock.ts`의 라이브 판정 창(일요일 13:45~16:00)은 여기서 파생되지 않는다.**
 *    15분 전 시작은 예배 시각의 파생이 아니라 운영 관행이라 일부러 묶지 않았다.
 *    `YOUTH_SERVICE_TIME`을 고칠 때 `mock.ts`의 그 창도 함께 봐야 한다.
 *
 * ⚠️ 아래 `*_LINE` 상수는 **metadata description에 들어간다.** 길이를 늘리면
 *    6개 화면의 검색 스니펫이 잘린다.
 */

import { VENUE } from "@/content/location";

/* ── 1층: 원자 ────────────────────────────────────────────── */

/** 청년예배 (주보: 청년교회 오후 02:00) */
export const YOUTH_SERVICE_TIME = "14:00";
/** 마을모임 시작 — 예배 직후 */
export const VILLAGE_TIME = "15:30";
/** 마을모임 종료. 주일 일정의 끝이라 JSON-LD `closes`로도 쓴다 */
export const VILLAGE_END_TIME = "16:00";
/** 금요기도회 (주보: 오후 08:00) */
export const FRIDAY_PRAYER_TIME = "20:00";

/** 본당 주일예배 — 김해교회 본당에서 열린다. 드림센터가 아니다 */
export const MAIN_SERVICE_TIMES = ["07:30", "09:30", "11:30"] as const;

/* ── 1.5층: 한글 표기는 파생이다 ──────────────────────────── */

/**
 * `"14:00"` → `"오후 2시"`, `"15:30"` → `"오후 3시 30분"`.
 *
 * `sermons/page.tsx`가 한글 표기를 쓴다. `YOUTH_SERVICE_TIME_KO = "오후 2시"`로
 * 나란히 두면 **원자와 다툴 수 있는 두 번째 진실**이 되므로 계산한다.
 *
 * `Intl.DateTimeFormat("ko-KR")`은 `오후 2:00`을 내놓아 쓰지 않았다 — 더미
 * `Date`가 필요하고 타임존 함정이 붙는데 결과도 원하는 모양이 아니다.
 */
export function toKoreanTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  // 분이 00이면 생략한다 — "오후 2시 0분"은 사람이 쓰는 말이 아니다
  return m === 0 ? `${period} ${hour12}시` : `${period} ${hour12}시 ${m}분`;
}

/* ── 2층: 문구 ────────────────────────────────────────────── */

/**
 * 화면용 한 줄. **끝에 문장부호를 넣지 않는다** —
 * `welcome/register/RegisterForm.tsx`가 뒤에 `. 등록 없이…`를 이어 붙이므로
 * 마침표를 넣으면 `4층.. 등록`이 된다.
 */
export const YOUTH_SERVICE_LINE = `주일 ${YOUTH_SERVICE_TIME} · ${VENUE}`;

/**
 * metadata·검색용. 가운뎃점이 없다 — 검색 스니펫에서 노이즈이고 스크린리더가
 * "가운뎃점"으로 읽는다. 두 상수가 같은 원자에서 나오므로 갈라질 일은 없다.
 */
export const YOUTH_SERVICE_LINE_PLAIN = `주일 ${YOUTH_SERVICE_TIME} ${VENUE}`;

/** 마을모임 시간 문구 */
export const VILLAGE_LINE = `예배 후 ${VILLAGE_TIME}~${VILLAGE_END_TIME}`;

/* ── 3층: 표 ──────────────────────────────────────────────── */

export type ServiceRow = {
  /** 표 첫 칸. 주보 표기를 따른다 */
  name: string;
  /** 화면에 그대로 그리는 시각 (요일이 붙는다) */
  time: string;
  place: string;
  /**
   * 정규 시각·장소에서 벗어나는 예외.
   *
   * ⚠️ **null은 "예외가 없다"는 뜻이다** — `links.ts`의 null 규약과 같이,
   *    렌더하는 쪽에서 걸러 줄 자체를 그리지 않는다.
   */
  exception: string | null;
};

/** 청년예배와 마을모임 — 이 사이트의 주인공 */
export const YOUTH_GATHERINGS: ServiceRow[] = [
  { name: "청년예배", time: `주일 ${YOUTH_SERVICE_TIME}`, place: VENUE, exception: null },
  { name: "마을모임", time: VILLAGE_LINE, place: VENUE, exception: null },
];

export const PRAYER_MEETINGS: ServiceRow[] = [
  {
    name: "금요기도회",
    time: `금요일 ${FRIDAY_PRAYER_TIME}`,
    place: VENUE,
    /*
      주보 원문: `금요기도회 오후 08:00 (드림센터 4층 / 매달 둘째 주 본당)`.

      `nthWeekOfMonth: 2`로 구조화하지 않았다 — **주보가 "둘째 주"의 기준을
      적어두지 않았다.** 그 달 첫 금요일부터 세는지, 첫 주일이 든 주부터 세는지
      모른다. 구조화하면 코드가 "이번 주가 둘째 주인지" 계산하게 되는데, 우리가
      모르는 규칙을 계산하는 셈이다 (`parking.ts`가 못 잰 도보 시간을 거리 대신
      위치 관계로 적은 것과 같은 판단 — 숫자를 지어내지 않는다).
    */
    exception: "매달 둘째 주는 본당에서 모입니다",
  },
];

/**
 * 모교회 본당 주일예배.
 *
 * ⚠️ **장소가 드림센터가 아니다.** 이 사이트 최대 사고 지점이 "본당 vs
 *    드림센터 혼동"이라, 이 배열을 그리는 화면은 반드시 장소 경고를 함께 둔다.
 */
export const MAIN_CHURCH_SERVICES: ServiceRow[] = MAIN_SERVICE_TIMES.map((time, i) => ({
  name: `${i + 1}부`,
  time: `주일 ${time}`,
  place: "김해교회 본당",
  exception: null,
}));
