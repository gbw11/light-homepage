import type {
  AdminMember,
  AlbumInput,
  AlbumSummary,
  AttachmentUpload,
  AuthUser,
  Bulletin,
  BulletinSummary,
  CompleteProfileInput,
  Cursor,
  MeetingDetail,
  MeetingSummary,
  NewcomerRecord,
  Photo,
  Role,
  StorageUsage,
  LoginInput,
  LoginResult,
  NewcomerSubmission,
  Page,
  PostAttachment,
  PostDetail,
  PostInput,
  PostSummary,
  SignupInput,
} from "@/types/api";
import { ApiError } from "./error";
import { notifySessionExpired } from "./session";
import type { Api } from "./types";

/**
 * 백엔드 없이 화면을 완성하기 위한 mock.
 *
 * ★ 성공 경로만 만들면 통합 때 무너진다 (docs/INTEGRATION.md).
 *   실패 케이스를 반드시 함께 넣는다: 401 · 403 · PENDING_APPROVAL ·
 *   STORAGE_LIMIT · 업로드 실패 · 빈 목록.
 *
 * 강제 방법: 쿼리스트링 `?mock=unauthorized` 처럼 시나리오를 지정한다.
 */
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

/** 현재 URL의 `?mock=` 값 (브라우저에서만) */
function scenario(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("mock");
}

function throwIfScenario() {
  switch (scenario()) {
    case "unauthorized":
      throw new ApiError({
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
        status: 401,
      });
    case "forbidden":
      throw new ApiError({
        code: "FORBIDDEN",
        message: "권한이 없습니다.",
        status: 403,
      });
    case "pending":
      throw new ApiError({
        code: "PENDING_APPROVAL",
        message: "승인 대기 중입니다.",
        status: 403,
      });
    case "storage":
      throw new ApiError({
        code: "STORAGE_LIMIT",
        message: "저장 용량이 부족합니다.",
        status: 409,
      });
  }
}

const NOTICES: PostSummary[] = [
  {
    id: "18",
    category: "NOTICE_PUBLIC",
    title: "여름 수련회 신청 안내",
    slug: "summer-retreat-2026",
    pinned: true,
    authorName: "박OO",
    publishedAt: "2026-08-24T01:00:00Z",
    attachmentCount: 1,
  },
  {
    id: "17",
    category: "NOTICE_PUBLIC",
    title: "8월 마을모임 편성",
    slug: "august-village-groups",
    pinned: false,
    authorName: "김OO",
    publishedAt: "2026-08-10T01:00:00Z",
    attachmentCount: 0,
  },
  {
    id: "16",
    category: "NOTICE_PUBLIC",
    title: "여름 성경학교 후기",
    slug: "summer-bible-school-recap",
    pinned: false,
    authorName: "이OO",
    publishedAt: "2026-08-05T01:00:00Z",
    attachmentCount: 0,
  },
  {
    id: "15",
    category: "NOTICE_PUBLIC",
    title: "청년교회 사진관 오픈 안내",
    slug: "photo-gallery-open",
    pinned: false,
    authorName: "박OO",
    publishedAt: "2026-07-28T01:00:00Z",
    attachmentCount: 0,
  },
  {
    id: "21",
    category: "NOTICE_MEMBER",
    title: "마을모임 장소 변경 안내",
    slug: "village-meeting-location-change",
    pinned: false,
    authorName: "김OO",
    publishedAt: "2026-08-22T01:00:00Z",
    attachmentCount: 0,
  },
  {
    id: "20",
    category: "NOTICE_MEMBER",
    title: "회비 납부 안내",
    slug: "membership-fee-guide",
    pinned: false,
    authorName: "박OO",
    publishedAt: "2026-08-18T01:00:00Z",
    attachmentCount: 1,
  },
  {
    id: "19",
    category: "NOTICE_MEMBER",
    title: "리더 모임 일정 공유",
    slug: "leader-meeting-schedule",
    pinned: false,
    authorName: "이OO",
    publishedAt: "2026-08-12T01:00:00Z",
    attachmentCount: 0,
  },
  // ── 문서 게시판 (FR-DOC) — 임원(`L`) 이상만 열람 가능한 분류 ──
  {
    id: "31",
    category: "MINUTES",
    title: "8월 정기 임원회의록",
    slug: "minutes-2026-08",
    pinned: false,
    authorName: "박OO",
    publishedAt: "2026-08-21T01:00:00Z",
    attachmentCount: 1,
  },
  {
    id: "30",
    category: "MINUTES",
    title: "7월 정기 임원회의록",
    slug: "minutes-2026-07",
    pinned: false,
    authorName: "박OO",
    publishedAt: "2026-07-17T01:00:00Z",
    attachmentCount: 0,
  },
  {
    id: "33",
    category: "BUDGET",
    title: "2026년 하반기 예산안",
    slug: "budget-2026-h2",
    pinned: true,
    authorName: "최OO",
    publishedAt: "2026-08-19T01:00:00Z",
    attachmentCount: 1,
  },
  {
    id: "32",
    category: "BUDGET",
    title: "2026년 상반기 결산 보고",
    slug: "budget-2026-h1-report",
    pinned: false,
    authorName: "최OO",
    publishedAt: "2026-07-10T01:00:00Z",
    attachmentCount: 0,
  },
];

/** `PostSummary`에 상세 조회용 `body`/`attachments`만 덧붙인 것 — 목록과 동일 소스를 공유한다 */
const NOTICE_DETAILS: Record<string, Pick<PostDetail, "body" | "updatedAt" | "attachments">> = {
  "18": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "이번 여름 수련회는 8월 24일부터 26일까지 진행됩니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "참가를 원하시는 분은 첨부된 신청서를 작성해 마을장에게 제출해 주세요." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "궁금한 점은 마을모임 시간에 안내드리겠습니다." }],
        },
      ],
    },
    updatedAt: "2026-08-24T01:00:00Z",
    attachments: [
      {
        id: "7",
        filename: "신청서.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: 24576,
      },
    ],
  },
  "17": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "8월 마을모임이 새롭게 편성되었습니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "각 마을장에게 개별 안내드렸으니 확인해 주세요." }],
        },
      ],
    },
    updatedAt: "2026-08-10T01:00:00Z",
    attachments: [],
  },
  /**
   * ★ 이 글은 **에디터가 만들 수 있는 모든 노드/마크를 한 번씩 쓴다**
   *   (`POST_BODY_NODES`/`POST_BODY_MARKS`). 읽기 화면(`PostBodyView`)이
   *   에디터를 따라오는지 눈으로 확인하는 기준 데이터다 — 툴바를 늘리면
   *   여기에도 추가해서 렌더가 빠지는 걸 바로 보이게 한다.
   */
  "16": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "지난주 여름 성경학교가 " },
            { type: "text", marks: [{ type: "bold" }], text: "은혜롭게" },
            { type: "text", text: " 마무리되었습니다." },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "함께한 순서" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "말씀 나눔" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", marks: [{ type: "italic" }], text: "찬양과 기도" },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "다음 일정" }],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", marks: [{ type: "underline" }], text: "9월 마을모임" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", marks: [{ type: "strike" }], text: "8월 수련회(종료)" },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "함께해주신 모든 분들께 감사드립니다." }],
            },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "사진은 " },
            {
              type: "text",
              marks: [{ type: "link", attrs: { href: "/my/photos" } }],
              text: "사진첩",
            },
            { type: "text", text: "에서 보실 수 있습니다." },
            { type: "hardBreak" },
            { type: "text", text: "문의는 임원에게 주세요." },
          ],
        },
      ],
    },
    updatedAt: "2026-08-05T01:00:00Z",
    attachments: [],
  },
  "15": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "청년교회 사진관이 새롭게 열렸습니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "회원 로그인 후 사진첩 메뉴에서 확인하실 수 있습니다." }],
        },
      ],
    },
    updatedAt: "2026-07-28T01:00:00Z",
    attachments: [],
  },
  "21": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "이번 주 마을모임 장소가 변경되었습니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "자세한 위치는 마을장에게 개별 안내드렸습니다." }],
        },
      ],
    },
    updatedAt: "2026-08-22T01:00:00Z",
    attachments: [],
  },
  "20": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "8월 회비 납부 기간은 8월 18일부터 25일까지입니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "납부 방법은 첨부된 안내문을 참고해 주세요." }],
        },
      ],
    },
    updatedAt: "2026-08-18T01:00:00Z",
    attachments: [
      {
        id: "9",
        filename: "회비납부안내.pdf",
        contentType: "application/pdf",
        sizeBytes: 51200,
      },
    ],
  },
  "19": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "8월 리더 모임 일정을 공유드립니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "참석이 어려운 리더는 미리 말씀해 주세요." }],
        },
      ],
    },
    updatedAt: "2026-08-12T01:00:00Z",
    attachments: [],
  },
  "31": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "일시: 2026년 8월 21일 20:00 · 장소: 청년부실 · 참석 7명" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "1. 여름 수련회 결산 보고 — 참가비 잔액은 가을 전도축제 예산으로 이월하기로 결의했습니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "2. 마을 재편성 — 9월 첫 주에 새가족 3명을 각 마을에 배정합니다." }],
        },
      ],
    },
    updatedAt: "2026-08-22T05:00:00Z",
    attachments: [
      {
        id: "31",
        filename: "2026-08_임원회의록.pdf",
        contentType: "application/pdf",
        sizeBytes: 189440,
      },
    ],
  },
  "30": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "일시: 2026년 7월 17일 20:00 · 장소: 청년부실 · 참석 6명" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "1. 수련회 준비 상황 점검 — 숙소 계약 완료, 차량 2대 확보." }],
        },
      ],
    },
    updatedAt: "2026-07-17T13:00:00Z",
    attachments: [],
  },
  "33": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "2026년 하반기(7~12월) 청년교회 예산안입니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "총 수입 8,400,000원 · 총 지출 8,150,000원 · 예비비 250,000원." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "세부 항목은 첨부된 파일을 확인해 주세요. 문의는 회계 담당 임원에게 부탁드립니다." }],
        },
      ],
    },
    updatedAt: "2026-08-19T02:00:00Z",
    attachments: [
      {
        id: "33",
        filename: "예산안_2026_하반기.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: 43008,
      },
    ],
  },
  "32": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "2026년 상반기(1~6월) 결산 보고입니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "집행률 96% · 잔액 320,000원은 하반기 예비비로 이월했습니다." }],
        },
      ],
    },
    updatedAt: "2026-07-10T02:00:00Z",
    attachments: [],
  },
};

// ── 사진첩 mock (SPEC_API §6) ──────────────────────────────
/**
 * 실제 수련회 사진 47장을 `public/photos/retreat-2026/`에 최적화해 넣어뒀다
 * (원본 277MB → 7.3MB, WebP, **EXIF 제거**).
 *
 * ⚠️ 실서비스에서 이 URL은 **R2 presigned URL**이 된다 (SPEC_API §6.4).
 *    mock은 정적 경로를 쓰므로 만료·서명이 없다 — 통합 시 URL 형태가 바뀌는 것을
 *    전제로 화면을 만든다 (경로를 조립하지 말고 응답의 URL을 그대로 쓴다).
 *
 * 세로/가로가 섞여 있어야 그리드·라이트박스가 실제 조건에서 검증된다.
 * 아래 크기는 manifest.json의 실측값이다.
 */
const RETREAT_PHOTO_COUNT = 47;
/** 16:9 전경 사진 슬러그 (p036~p047) — 나머지는 4:3 */
const WIDE_SLUGS = new Set(
  Array.from({ length: 12 }, (_, i) => `p${String(i + 36).padStart(3, "0")}`),
);
/** 유일한 세로 사진 — `public/photos/retreat-2026/manifest.json` 실측값 기준 */
const PORTRAIT_SLUG = "p035";

function retreatPhoto(index: number): Photo {
  const slug = `p${String(index + 1).padStart(3, "0")}`;
  const [width, height] =
    slug === PORTRAIT_SLUG ? [1200, 1600] : WIDE_SLUGS.has(slug) ? [1600, 900] : [1600, 1200];

  // 수련회 기간(2026-08-19) 안에서 순서대로 촬영된 것처럼 시각을 흩뿌린다
  const takenAt = new Date(Date.UTC(2026, 7, 19, 8, 0, 0) + index * 7 * 60_000).toISOString();

  return {
    id: `${901 + index}`,
    thumbUrl: `/photos/retreat-2026/thumb/${slug}.webp`,
    viewUrl: `/photos/retreat-2026/view/${slug}.webp`,
    width,
    height,
    takenAt,
  };
}

const RETREAT_PHOTOS: Photo[] = Array.from({ length: RETREAT_PHOTO_COUNT }, (_, i) =>
  retreatPhoto(i),
);

const ALBUMS: AlbumSummary[] = [
  {
    id: "5",
    title: "2026 여름 수련회",
    eventDate: "2026-08-19",
    photoCount: RETREAT_PHOTOS.length,
    coverThumbUrl: RETREAT_PHOTOS[0].thumbUrl,
  },
  {
    id: "4",
    title: "2026 전도축제",
    eventDate: "2026-05-18",
    photoCount: 0,
    // 사진이 없는 앨범 — 커버가 null인 상태를 화면이 처리해야 한다
    coverThumbUrl: null,
  },
];

/** 이번 세션 중 만든 앨범 (새로고침하면 사라진다) */
const dynamicAlbums: AlbumSummary[] = [];

// ── 주보 mock (SPEC_API §5) ────────────────────────────────
/**
 * ⚠️ **실제 주보 이미지가 아니다.** `public/bulletins/`의 이미지는 "PLACEHOLDER"
 *    문구가 찍힌 생성물이다. 남의 주보를 가져다 쓰지 않았고, 실제 주보처럼
 *    보이는 가짜를 만들지도 않았다 — 실물이 준비되면 교체한다.
 *
 * 크기는 스펙대로 1448×2048(장변 2048px)이다. 주보는 글자가 작아 큰 이미지를
 * 바로 로드해야 하므로(FR-BUL-03), 뷰어가 실제 크기에서 검증되어야 한다.
 */
const BULLETIN_DATES: { id: string; date: string; pages: number }[] = [
  { id: "12", date: "2026-08-24", pages: 2 },
  { id: "11", date: "2026-08-17", pages: 2 },
  { id: "10", date: "2026-08-10", pages: 1 },
];

function bulletinOf(entry: (typeof BULLETIN_DATES)[number]): Bulletin {
  return {
    id: entry.id,
    serviceDate: entry.date,
    pages: Array.from({ length: entry.pages }, (_, i) => ({
      pageNo: i + 1,
      url: `/bulletins/${entry.date}-p${i + 1}.webp`,
      width: 1448,
      height: 2048,
    })),
  };
}

// ── 월례회 mock (SPEC_API §7) ──────────────────────────────
/**
 * ⚠️ **mock으로는 이 기능의 핵심을 검증할 수 없다.**
 *    월례회는 (a) 서버가 워터마크를 합성하고 (b) presigned URL을 발급하지 않고
 *    직접 스트리밍하며 (c) `Cache-Control: no-store`로 캐시를 막는 것이 요구사항이다.
 *    mock에는 서버가 없으므로 **열람 기간 판정과 화면 상태만** 흉내낸다.
 *    워터마크·스트리밍·열람 로그는 BE 구현 후 통합에서 확인해야 한다.
 *
 * 상태 3가지가 모두 필요하다 — 화면이 SCHEDULED/OPEN/CLOSED를 다르게 보여야 한다.
 */
const MEETINGS: MeetingSummary[] = [
  {
    id: "3",
    title: "2026년 8월 월례회",
    meetingDate: "2026-08-24",
    pageCount: 10,
    viewableFrom: "2026-08-24T11:00:00Z",
    viewableUntil: "2026-08-26T14:59:00Z",
    status: "OPEN",
  },
  {
    id: "2",
    title: "2026년 6월 월례회",
    meetingDate: "2026-06-22",
    pageCount: 8,
    viewableFrom: "2026-06-22T11:00:00Z",
    viewableUntil: "2026-06-24T14:59:00Z",
    status: "CLOSED",
  },
  {
    id: "4",
    title: "2026년 9월 월례회",
    meetingDate: "2026-09-28",
    pageCount: 6,
    viewableFrom: "2026-09-28T11:00:00Z",
    viewableUntil: "2026-09-30T14:59:00Z",
    status: "SCHEDULED",
  },
];

// ── 관리 mock (SPEC_API §8) ────────────────────────────────
const ADMIN_NEWCOMERS: NewcomerRecord[] = [
  {
    id: "14",
    name: "김OO",
    phone: "010-1234-5678",
    gender: "MALE",
    ageGroup: "EARLY_20S",
    referrer: "FRIEND",
    message: "친구 소개로 가보려고요",
    createdAt: "2026-08-19T10:22:00Z",
  },
  {
    id: "13",
    name: "박OO",
    phone: "010-5555-6666",
    gender: "FEMALE",
    ageGroup: "LATE_20S",
    referrer: "SEARCH",
    // 선택 항목이 비어 있는 경우도 화면이 처리해야 한다
    message: null,
    createdAt: "2026-08-12T04:10:00Z",
  },
];

// ── 인증 mock 세션 ────────────────────────────────────────
// 실제 백엔드는 httpOnly 쿠키로 세션을 유지한다 (SPEC_API §1.4). mock에는
// 서버가 없으므로 브라우저 localStorage로 흉내낸다 — 새로고침해도 로그인
// 상태가 유지돼야 화면 작업이 가능하다.
const MOCK_SESSION_KEY = "light-mock-session";

function readSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(MOCK_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function writeSession(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(MOCK_SESSION_KEY);
}

function requireSession(): AuthUser {
  const user = readSession();
  if (!user) {
    throw new ApiError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다.", status: 401 });
  }
  return user;
}

/** 로그인 테스트 계정 — 비밀번호는 전부 `password12!` */
const MOCK_PASSWORD = "password12!";
const MOCK_USERS: Record<string, AuthUser> = {
  "member@example.com": {
    id: "42",
    name: "김OO",
    email: "member@example.com",
    phone: "010-1234-5678",
    village: "3",
    role: "MEMBER",
    profileComplete: true,
    approvedAt: "2026-08-20T02:11:00Z",
  },
  "pending@example.com": {
    id: "43",
    name: "이OO",
    email: "pending@example.com",
    phone: "010-2222-3333",
    village: "newcomer",
    role: "PENDING",
    profileComplete: true,
    approvedAt: null,
  },
  "leader@example.com": {
    id: "7",
    name: "박OO",
    email: "leader@example.com",
    phone: "010-9999-0000",
    village: "1",
    role: "LEADER",
    profileComplete: true,
    approvedAt: "2026-01-05T02:11:00Z",
  },
  "pastor@example.com": {
    id: "1",
    name: "최OO",
    email: "pastor@example.com",
    phone: "010-7777-8888",
    village: "1",
    role: "PASTOR",
    profileComplete: true,
    approvedAt: "2025-03-02T02:11:00Z",
  },
};

/** 이번 세션 중 가입한 계정 — 새로고침하면 사라진다 (실제 DB 아님) */
const dynamicUsers: Record<string, AuthUser> = {};

function toLoginResult(user: AuthUser): LoginResult {
  return {
    id: user.id,
    name: user.name,
    village: user.village,
    role: user.role,
    profileComplete: user.profileComplete,
  };
}

// ── 게시물 작성·첨부 mock (SPEC_API §3.4 · §3.5 · §4) ──────
/**
 * 이번 세션 중 작성·수정한 글. 새로고침하면 사라진다 (dynamicAlbums와 같은 원칙 —
 * mock에는 서버가 없다).
 *
 * ⚠️ **모듈 메모리라서 브라우저와 서버가 각각 따로 가진다.** 브라우저에서 쓴 글은
 *    서버 컴포넌트(`/news/[slug]` 등)에서 보이지 않는다. mock의 한계이므로
 *    작성 화면은 저장 후 본문을 **렌더러와 같은 컴포넌트**로 다시 보여준다
 *    (`PostBodyView`) — 저장 결과를 화면에서 확인할 수 있게.
 */
type MockPost = {
  summary: PostSummary;
  detail: Pick<PostDetail, "body" | "updatedAt" | "attachments">;
};
const dynamicPosts: MockPost[] = [];
/** 삭제된 글 id — 정적 mock 데이터는 지울 수 없으니 가려서 흉내낸다 */
const removedPostIds = new Set<string>();
/** 업로드됐지만 아직 게시물에 연결되지 않은 첨부 (실서비스는 24시간 후 정리) */
const uploadedAttachments = new Map<string, PostAttachment>();

/** 정적 + 동적 mock 글을 하나로 합친다. 같은 id는 **동적 쪽이 이긴다**(수정 반영) */
function mockPostSummaries(): PostSummary[] {
  const overridden = new Set(dynamicPosts.map((p) => p.summary.id));
  return [
    ...dynamicPosts.map((p) => p.summary),
    ...NOTICES.filter((n) => !overridden.has(n.id)),
  ].filter((p) => !removedPostIds.has(p.id));
}

/** SPEC_API §3.1 — 작성은 전부 권한 `L`. 서버가 실제로 막지만 mock도 흉내낸다 */
function requireLeader(message: string): AuthUser {
  const user = requireSession();
  if (user.role !== "LEADER" && user.role !== "PASTOR") {
    throw new ApiError({ code: "FORBIDDEN", message, status: 403 });
  }
  return user;
}

function validatePostInput(input: PostInput) {
  if (!input.title.trim()) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      message: "제목을 입력해주세요.",
      status: 400,
      field: "title",
    });
  }
  if (input.body.content.length === 0) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      message: "본문을 입력해주세요.",
      status: 400,
      field: "body",
    });
  }
  const unknownId = input.attachmentIds.find((id) => !uploadedAttachments.has(id));
  if (unknownId) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      message: "업로드되지 않은 첨부가 있습니다.",
      status: 400,
      field: "attachmentIds",
    });
  }
}

function buildMockPost(id: string, input: PostInput, authorName: string): MockPost {
  const now = new Date().toISOString();
  return {
    summary: {
      id,
      category: input.category,
      title: input.title.trim(),
      // 실제 slug는 서버가 만든다 (한글 제목 → 음역/랜덤). mock은 id로 대체한다
      slug: `post-${id}`,
      pinned: input.pinned,
      authorName,
      // 임시저장이면 null (SPEC_API §3.4)
      publishedAt: input.publish ? now : null,
      attachmentCount: input.attachmentIds.length,
    },
    detail: {
      body: input.body,
      updatedAt: now,
      attachments: input.attachmentIds.map(
        (aid) => uploadedAttachments.get(aid) as PostAttachment,
      ),
    },
  };
}

export const mockApi: Api = {
  posts: {
    async list({ category, page = 0, size = 20 }): Promise<Page<PostSummary>> {
      await delay();
      throwIfScenario();

      // 빈 목록도 반드시 확인해야 하는 상태다
      const items =
        scenario() === "empty"
          ? []
          : mockPostSummaries().filter((p) => p.category === category);

      return { items, page, size, hasNext: false };
    },

    async get(idOrSlug: string): Promise<PostDetail> {
      await delay();
      throwIfScenario();

      const dynamic = dynamicPosts.find(
        (p) => p.summary.id === idOrSlug || p.summary.slug === idOrSlug,
      );
      const summary = dynamic
        ? dynamic.summary
        : mockPostSummaries().find((p) => p.id === idOrSlug || p.slug === idOrSlug);
      const detail = dynamic ? dynamic.detail : summary ? NOTICE_DETAILS[summary.id] : undefined;

      if (!summary || !detail || removedPostIds.has(summary.id)) {
        throw new ApiError({
          code: "NOT_FOUND",
          message: "글을 찾을 수 없습니다.",
          status: 404,
        });
      }

      return {
        id: summary.id,
        category: summary.category,
        title: summary.title,
        slug: summary.slug,
        body: detail.body,
        pinned: summary.pinned,
        authorName: summary.authorName,
        publishedAt: summary.publishedAt,
        updatedAt: detail.updatedAt,
        attachments: detail.attachments,
      };
    },

    async create(input: PostInput): Promise<{ id: string }> {
      await delay();
      throwIfScenario();
      const user = requireLeader("글 작성 권한이 없습니다.");
      validatePostInput(input);

      const id = `${Date.now()}`;
      dynamicPosts.unshift(buildMockPost(id, input, user.name));
      return { id };
    },

    async update(id: string, input: PostInput): Promise<void> {
      await delay();
      throwIfScenario();
      const user = requireLeader("글 수정 권한이 없습니다.");
      validatePostInput(input);

      const existing = mockPostSummaries().find((p) => p.id === id);
      if (!existing) {
        throw new ApiError({ code: "NOT_FOUND", message: "글을 찾을 수 없습니다.", status: 404 });
      }

      const next = buildMockPost(id, input, existing.authorName || user.name);
      // 정적 mock 글을 수정하면 동적 쪽에 덮어쓰기 항목이 생긴다 (mockPostSummaries가 우선)
      next.summary.slug = existing.slug;
      next.summary.publishedAt = input.publish ? (existing.publishedAt ?? next.summary.publishedAt) : null;

      const at = dynamicPosts.findIndex((p) => p.summary.id === id);
      if (at >= 0) dynamicPosts[at] = next;
      else dynamicPosts.unshift(next);
    },

    async remove(id: string): Promise<void> {
      await delay();
      throwIfScenario();
      requireLeader("글 삭제 권한이 없습니다.");

      if (!mockPostSummaries().some((p) => p.id === id)) {
        throw new ApiError({ code: "NOT_FOUND", message: "글을 찾을 수 없습니다.", status: 404 });
      }
      removedPostIds.add(id);
    },
  },
  attachments: {
    async upload(file: File): Promise<AttachmentUpload> {
      // 업로드는 목록 조회보다 오래 걸린다 — 진행 표시가 실제로 보여야 한다
      await delay(700);
      throwIfScenario();
      requireLeader("첨부 업로드 권한이 없습니다.");

      // 성공 경로만 만들면 통합 때 무너진다: 파일명에 `fail`이 들어가면 실패시킨다
      if (/fail/i.test(file.name)) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "파일을 업로드할 수 없습니다.",
          status: 400,
          field: "file",
        });
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new ApiError({
          code: "STORAGE_LIMIT",
          message: "20MB 이하 파일만 올릴 수 있습니다.",
          status: 409,
        });
      }

      const id = `a${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const attachment: PostAttachment = {
        id,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      };
      uploadedAttachments.set(id, attachment);

      // §4.1 응답은 contentType을 주지 않는다 — 화면이 없는 필드를 기대하지 않게 그대로 맞춘다
      return { id, filename: attachment.filename, sizeBytes: attachment.sizeBytes };
    },

    downloadUrl(attachmentId: string): string {
      // 실제로는 302 → presigned. mock에는 파일이 없으므로 눌러도 열리지 않는다
      return `/api/files/${encodeURIComponent(attachmentId)}`;
    },
  },
  newcomers: {
    async submit(input: NewcomerSubmission): Promise<{ id: string }> {
      await delay();
      throwIfScenario();

      if (input.agreed !== true) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "개인정보 동의가 필요합니다.",
          status: 400,
          field: "agreed",
        });
      }

      return { id: `${Date.now()}` };
    },
  },
  albums: {
    async list({ page = 0, size = 20 } = {}): Promise<Page<AlbumSummary>> {
      await delay();
      throwIfScenario();
      requireSession();

      const all = scenario() === "empty" ? [] : [...dynamicAlbums, ...ALBUMS];
      return { items: all.slice(page * size, (page + 1) * size), page, size, hasNext: false };
    },

    async create(input: AlbumInput): Promise<{ id: string }> {
      await delay();
      throwIfScenario();
      const user = requireSession();

      // SPEC_API §6.2 — 권한 `L`(임원) 이상. 서버가 실제로 막지만 mock도 흉내낸다
      if (user.role !== "LEADER" && user.role !== "PASTOR") {
        throw new ApiError({
          code: "FORBIDDEN",
          message: "앨범 생성 권한이 없습니다.",
          status: 403,
        });
      }
      if (!input.title.trim()) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "앨범 제목을 입력해주세요.",
          status: 400,
          field: "title",
        });
      }

      const id = `${Date.now()}`;
      dynamicAlbums.unshift({
        id,
        title: input.title.trim(),
        eventDate: input.eventDate,
        photoCount: 0,
        coverThumbUrl: null,
      });
      return { id };
    },

    async photos(
      albumId: string,
      { cursor, size = 20 } = {},
    ): Promise<Cursor<Photo>> {
      await delay();
      throwIfScenario();
      requireSession();

      const known = [...dynamicAlbums, ...ALBUMS].find((a) => a.id === albumId);
      if (!known) {
        throw new ApiError({ code: "NOT_FOUND", message: "앨범을 찾을 수 없습니다.", status: 404 });
      }

      // 사진이 있는 앨범은 5번뿐 — 나머지는 빈 목록(화면이 처리해야 하는 상태)
      const source = albumId === "5" && scenario() !== "empty" ? RETREAT_PHOTOS : [];

      // 커서는 불투명한 문자열이어야 한다 (SPEC_API §1.6). 오프셋을 감싸 흉내낸다
      const offset = cursor ? Number(atob(cursor)) || 0 : 0;
      const items = source.slice(offset, offset + size);
      const next = offset + items.length;
      const hasNext = next < source.length;

      return { items, nextCursor: hasNext ? btoa(String(next)) : null, hasNext };
    },

    downloadUrl(albumId: string, photoIds: string[]): string {
      // 실제로는 ZIP 스트리밍 엔드포인트다. mock은 ZIP을 만들 수 없으므로
      // `capabilities.zipDownload = false`로 화면이 안내를 띄우게 한다.
      const ids = photoIds.join(",");
      return `/api/albums/${encodeURIComponent(albumId)}/download?ids=${ids}`;
    },
  },
  photos: {
    async report(photoId: string, input: { reason: string }): Promise<void> {
      await delay();
      throwIfScenario();
      requireSession();

      if (!input.reason.trim()) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "요청 내용을 입력해주세요.",
          status: 400,
          field: "reason",
        });
      }
      if (!RETREAT_PHOTOS.some((p) => p.id === photoId)) {
        throw new ApiError({ code: "NOT_FOUND", message: "사진을 찾을 수 없습니다.", status: 404 });
      }
      // 실제로는 임원에게 알림이 간다 (SPEC_API §6.10)
    },

    downloadUrl(photoId: string): string {
      // 실제 서버는 302 → presigned URL(attachment)로 보낸다.
      // mock은 정적 view 이미지를 그대로 가리킨다 — 브라우저가 저장하면 된다.
      const index = RETREAT_PHOTOS.findIndex((p) => p.id === photoId);
      return index >= 0
        ? RETREAT_PHOTOS[index].viewUrl
        : `/api/photos/${encodeURIComponent(photoId)}/download`;
    },
  },
  meetings: {
    async list({ page = 0, size = 20 } = {}): Promise<Page<MeetingSummary>> {
      await delay();
      throwIfScenario();
      requireSession();

      const all = scenario() === "empty" ? [] : MEETINGS;
      return { items: all.slice(page * size, (page + 1) * size), page, size, hasNext: false };
    },

    async get(id: string): Promise<MeetingDetail> {
      await delay();
      throwIfScenario();
      const user = requireSession();

      const m = MEETINGS.find((x) => x.id === id);
      if (!m) {
        throw new ApiError({ code: "NOT_FOUND", message: "자료를 찾을 수 없습니다.", status: 404 });
      }

      // SPEC_API §7.1: `L` 이상은 status와 무관하게 열람 가능
      const isLeader = user.role === "LEADER" || user.role === "PASTOR";
      const canView = isLeader || m.status === "OPEN";

      const remainingSeconds =
        m.status === "OPEN"
          ? Math.max(0, Math.floor((new Date(m.viewableUntil).getTime() - Date.now()) / 1000))
          : 0;

      return {
        id: m.id,
        title: m.title,
        meetingDate: m.meetingDate,
        pageCount: m.pageCount,
        status: m.status,
        viewableUntil: m.viewableUntil,
        remainingSeconds,
        canView,
        viewReason: canView ? null : "PERIOD_CLOSED",
      };
    },

    pageUrl(id: string, pageNo: number): string {
      /*
       * mock에는 워터마크를 합성해 스트리밍할 서버가 없다. 실제 엔드포인트
       * 경로를 그대로 돌려주므로 **mock 모드에서는 이미지가 뜨지 않는다** —
       * 화면이 이미지 로드 실패를 처리해야 한다는 뜻이고, 그게 의도다.
       * 가짜 이미지를 돌려주면 "워터마크 없이도 잘 보인다"는 착각을 만든다.
       */
      return `/api/meetings/${encodeURIComponent(id)}/pages/${encodeURIComponent(String(pageNo))}`;
    },
  },
  admin: {
    async members({ status = "PENDING", q, page = 0, size = 20 } = {}): Promise<
      Page<AdminMember>
    > {
      await delay();
      throwIfScenario();
      const user = requireSession();

      // SPEC_API §8.1 — 권한 `T`(PASTOR)만
      if (user.role !== "PASTOR") {
        throw new ApiError({ code: "FORBIDDEN", message: "권한이 없습니다.", status: 403 });
      }

      const all: AdminMember[] = Object.values(MOCK_USERS).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        village: u.village,
        role: u.role,
        profileComplete: u.profileComplete,
        createdAt: "2026-08-19T09:00:00Z",
        approvedAt: u.approvedAt,
      }));

      let items = status === "PENDING" ? all.filter((m) => m.role === "PENDING") : all;
      if (q?.trim()) items = items.filter((m) => m.name.includes(q.trim()));
      if (scenario() === "empty") items = [];

      return { items: items.slice(page * size, (page + 1) * size), page, size, hasNext: false };
    },

    async approveMember(): Promise<void> {
      await delay();
      throwIfScenario();
      const user = requireSession();
      if (user.role !== "PASTOR") {
        throw new ApiError({ code: "FORBIDDEN", message: "권한이 없습니다.", status: 403 });
      }
    },

    async rejectMember(_id: string, input: { reason: string }): Promise<void> {
      await delay();
      throwIfScenario();
      const user = requireSession();
      if (user.role !== "PASTOR") {
        throw new ApiError({ code: "FORBIDDEN", message: "권한이 없습니다.", status: 403 });
      }
      if (!input.reason.trim()) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "거절 사유를 입력해주세요.",
          status: 400,
          field: "reason",
        });
      }
    },

    async changeRole(id: string, input: { role: Role }): Promise<void> {
      await delay();
      throwIfScenario();
      const user = requireSession();
      if (user.role !== "PASTOR") {
        throw new ApiError({ code: "FORBIDDEN", message: "권한이 없습니다.", status: 403 });
      }

      /*
       * FR-ADM-05 자기 잠금 방지 — 마지막 PASTOR를 강등하면 아무도 회원을
       * 승인할 수 없게 된다. 서버가 막는 규칙이지만 mock에도 넣어야 화면이
       * 이 에러를 처리하는지 확인할 수 있다.
       */
      const pastors = Object.values(MOCK_USERS).filter((u) => u.role === "PASTOR");
      const target = Object.values(MOCK_USERS).find((u) => u.id === id);
      if (target?.role === "PASTOR" && input.role !== "PASTOR" && pastors.length <= 1) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "마지막 관리자의 권한은 변경할 수 없습니다. 다른 관리자를 먼저 지정해주세요.",
          status: 400,
          field: "role",
        });
      }
    },

    async storage(): Promise<StorageUsage> {
      await delay();
      throwIfScenario();
      const user = requireSession();
      if (user.role !== "LEADER" && user.role !== "PASTOR") {
        throw new ApiError({ code: "FORBIDDEN", message: "권한이 없습니다.", status: 403 });
      }

      // `?mock=storage`는 기존에 STORAGE_LIMIT 에러를 던진다 (throwIfScenario).
      // 여기서는 경고/차단 임계값 화면을 보기 위한 별도 시나리오를 둔다.
      const nearLimit = scenario() === "storage-warning";
      const blocked = scenario() === "storage-blocked";

      const limitBytes = 10_737_418_240;
      const usagePercent = blocked ? 96.4 : nearLimit ? 83.2 : 42.0;

      return {
        usedBytes: Math.round((limitBytes * usagePercent) / 100),
        limitBytes,
        usagePercent,
        photoCount: 3100,
        estimatedRemainingPhotos: blocked ? 0 : nearLimit ? 900 : 4300,
        warningThreshold: 80,
        blockThreshold: 95,
        uploadBlocked: blocked,
      };
    },

    async newcomers({ page = 0, size = 20 } = {}): Promise<Page<NewcomerRecord>> {
      await delay();
      throwIfScenario();
      const user = requireSession();
      if (user.role !== "LEADER" && user.role !== "PASTOR") {
        throw new ApiError({ code: "FORBIDDEN", message: "권한이 없습니다.", status: 403 });
      }

      const all = scenario() === "empty" ? [] : ADMIN_NEWCOMERS;
      return { items: all.slice(page * size, (page + 1) * size), page, size, hasNext: false };
    },
  },
  bulletins: {
    async latest(): Promise<Bulletin | null> {
      await delay();
      throwIfScenario();
      requireSession();

      // 주보가 아직 없는 상태도 화면이 처리해야 한다 (SPEC_API §5.1: data null)
      if (scenario() === "empty") return null;
      return bulletinOf(BULLETIN_DATES[0]);
    },

    async list({ page = 0, size = 20 } = {}): Promise<Page<BulletinSummary>> {
      await delay();
      throwIfScenario();
      requireSession();

      const all: BulletinSummary[] =
        scenario() === "empty"
          ? []
          : BULLETIN_DATES.map((b) => ({
              id: b.id,
              serviceDate: b.date,
              pageCount: b.pages,
              thumbUrl: `/bulletins/${b.date}-thumb.webp`,
            }));

      return { items: all.slice(page * size, (page + 1) * size), page, size, hasNext: false };
    },

    async get(id: string): Promise<Bulletin> {
      await delay();
      throwIfScenario();
      requireSession();

      const entry = BULLETIN_DATES.find((b) => b.id === id);
      if (!entry) {
        throw new ApiError({ code: "NOT_FOUND", message: "주보를 찾을 수 없습니다.", status: 404 });
      }
      return bulletinOf(entry);
    },
  },
  capabilities: {
    // mock은 ZIP을 만들 수 없다 — 화면이 "다운로드했습니다"라고 속이지 않도록
    zipDownload: false,
  },
  auth: {
    async signup(input: SignupInput): Promise<{ id: string; role: AuthUser["role"] }> {
      await delay();
      throwIfScenario();

      if (MOCK_USERS[input.email] || dynamicUsers[input.email]) {
        throw new ApiError({
          code: "DUPLICATE",
          message: "이미 가입된 이메일입니다.",
          status: 409,
          field: "email",
        });
      }
      if (input.agreed !== true) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "개인정보 수집·이용 동의가 필요합니다.",
          status: 400,
          field: "agreed",
        });
      }

      const id = `${Date.now()}`;
      dynamicUsers[input.email] = {
        id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        village: input.village,
        role: "PENDING",
        profileComplete: true,
        approvedAt: null,
      };
      return { id, role: "PENDING" };
    },

    async login(input: LoginInput): Promise<LoginResult> {
      await delay();
      throwIfScenario();

      const user = MOCK_USERS[input.email] ?? dynamicUsers[input.email];
      if (!user || input.password !== MOCK_PASSWORD) {
        throw new ApiError({
          code: "UNAUTHORIZED",
          message: "이메일 또는 비밀번호가 올바르지 않습니다.",
          status: 401,
        });
      }

      // 실제로는 서버가 쿠키를 심는다 — mock은 로그인 시도 자체로 세션을 만든다.
      writeSession(user);

      if (user.role === "PENDING") {
        // SPEC_API §2.2: "로그인은 성공, 회원 API는 차단" — 세션은 만들어지지만
        // 이 호출 자체는 에러로 응답해 FE가 /pending으로 보내게 한다.
        throw new ApiError({
          code: "PENDING_APPROVAL",
          message: "승인 대기 중입니다.",
          status: 403,
        });
      }

      return toLoginResult(user);
    },

    async logout(): Promise<void> {
      await delay(100);
      writeSession(null);
    },

    async refresh(): Promise<{ refreshed: boolean }> {
      await delay(100);
      throwIfScenario();
      if (!readSession()) {
        throw new ApiError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다.", status: 401 });
      }
      return { refreshed: true };
    },

    async me(): Promise<AuthUser> {
      await delay(150);

      // `?mock=session-expired` — 리프레시까지 실패해 되살릴 수 없는 세션.
      // 실제 백엔드에서는 real.ts의 401 재시도가 먼저 돌고, 그게 실패했을 때
      // 이 상태가 된다 (SPEC_API §12.2). mock에는 토큰이 없으므로 결과만 흉내낸다.
      // 기대 동작: AuthProvider가 세션을 비우고 → RequireMember가 /login으로 보낸다.
      if (scenario() === "session-expired") {
        writeSession(null);
        notifySessionExpired();
        throw new ApiError({
          code: "UNAUTHORIZED",
          message: "세션이 만료되었습니다. 다시 로그인해주세요.",
          status: 401,
        });
      }

      return requireSession();
    },

    async completeProfile(
      input: CompleteProfileInput,
    ): Promise<{ profileComplete: boolean; role: AuthUser["role"] }> {
      await delay();
      throwIfScenario();
      const current = requireSession();

      if (input.agreed !== true) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "개인정보 수집·이용 동의가 필요합니다.",
          status: 400,
          field: "agreed",
        });
      }

      const updated: AuthUser = {
        ...current,
        name: input.name,
        phone: input.phone,
        village: input.village,
        profileComplete: true,
        role: "PENDING",
      };
      writeSession(updated);
      return { profileComplete: true, role: "PENDING" };
    },

    async passwordResetRequest(): Promise<void> {
      await delay();
      // SPEC_API §2.9: 계정 존재 여부를 노출하지 않기 위해 항상 성공
    },

    async passwordResetConfirm(input: { token: string; password: string }): Promise<void> {
      await delay();
      throwIfScenario();
      if (input.token === "expired") {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "링크가 만료되었거나 이미 사용된 링크입니다.",
          status: 400,
          field: "token",
        });
      }
    },

    async updateProfile(input: { phone: string }): Promise<AuthUser> {
      await delay();
      throwIfScenario();
      const current = requireSession();
      const updated: AuthUser = { ...current, phone: input.phone };
      writeSession(updated);
      return updated;
    },

    async changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
      await delay();
      throwIfScenario();
      requireSession();
      if (input.currentPassword !== MOCK_PASSWORD) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "현재 비밀번호가 일치하지 않습니다.",
          status: 400,
          field: "currentPassword",
        });
      }
    },

    async deleteAccount(input: { password: string }): Promise<void> {
      await delay();
      throwIfScenario();
      requireSession();
      if (input.password !== MOCK_PASSWORD) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "비밀번호가 일치하지 않습니다.",
          status: 400,
          field: "password",
        });
      }
      writeSession(null);
    },
  },
};
