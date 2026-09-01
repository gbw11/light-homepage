/**
 * 사이트 내비게이션 구조 — 헤더(데스크톱 가로 메뉴·모바일 전체 메뉴)가 공유한다.
 *
 * ## 모교회 사이트와 뼈대를 맞춘다 (PM 요청 2026-09-01)
 *
 * 김해교회(`gloria.or.kr`)는 **상위 메뉴 아래 하위 항목이 펼쳐지는 가로
 * 내비게이션**을 쓴다 (교회소개 ▸ 위임목사 인사말·교회 역사·섬기는 이들…).
 * 우리도 같은 뼈대로 간다 — 모교회에서 넘어온 방문자가 같은 자리에서 같은
 * 모양을 본다.
 *
 * 다만 **항목까지 베끼지는 않는다.** 우리는 그 사이트의 `다음세대 ▸ 청년교회`
 * 한 칸에 해당하고, 우리 화면은 우리 스펙(`WIREFRAME.md`)이 정한다.
 *
 * ⚠️ 여기 있는 것은 **공개 화면뿐이다.** 회원 전용(`/photos`·`/meetings`·
 * `/documents`)은 `RESOURCE_LINKS`로 따로 두고, 관리 화면은 아예 넣지 않는다 —
 * 메뉴에 있는데 눌러서 게이트를 만나는 것보다 없는 편이 낫다.
 */
export type NavItem = {
  href: string;
  label: string;
  /** 있으면 데스크톱에서 드롭다운으로 펼친다 */
  children?: { href: string; label: string }[];
};

export const MENU_LINKS: NavItem[] = [
  {
    href: "/about",
    label: "소개",
    children: [
      { href: "/about", label: "청년교회 소개" },
      { href: "/welcome", label: "처음 오시는 분" },
      { href: "/location", label: "오시는 길" },
    ],
  },
  {
    href: "/worship",
    label: "예배와 모임",
  },
  {
    href: "/sermons",
    label: "말씀",
    children: [
      { href: "/sermons", label: "이번 주 예배" },
      { href: "/sermons/all", label: "지난 말씀" },
    ],
  },
  {
    href: "/news",
    label: "소식",
  },
  {
    href: "/bulletin",
    label: "주보",
  },
];

/**
 * 자료 — 회원 전용 열람 화면 (SPEC_API §3.1 v1.3에서 다시 `M`이 됐다).
 *
 * 공개 메뉴와 **줄을 나눠 둔다.** 섞으면 로그인 없이 누를 수 있는 것과 없는
 * 것이 한 줄에 뒤섞여서, 방문자가 절반을 눌러보고 나서야 그 사실을 안다.
 */
export const RESOURCE_LINKS: { href: string; label: string }[] = [
  { href: "/photos", label: "사진첩" },
  { href: "/meetings", label: "월례회 자료" },
  { href: "/documents", label: "회의록" },
];
