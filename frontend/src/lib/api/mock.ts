import type {
  AdminMember,
  AttendanceEntryInput,
  AttendanceSessionDetail,
  AttendanceSessionInput,
  AttendanceSessionSummary,
  AttendanceSessionType,
  AttendanceStatus,
  Village,
  AlbumInput,
  AlbumSummary,
  AttachmentUpload,
  AuthUser,
  Bulletin,
  BulletinInput,
  BulletinSummary,
  PasswordResetCode,
  Cursor,
  MeetingCreateInput,
  MeetingDetail,
  MeetingStatus,
  MeetingSummary,
  MeetingView,
  MeetingWindowInput,
  NewcomerRecord,
  Photo,
  Role,
  LiveStream,
  Sermon,
  StorageUsage,
  UploadCommitResult,
  UploadIssueInput,
  UploadTicket,
  LoginInput,
  LoginResult,
  NewcomerSubmission,
  Page,
  PostAttachment,
  PostDetail,
  PostInput,
  PostSummary,
  RegisterInput,
  RegisterResult,
  ResetPasswordWithCodeInput,
  VerifyRosterInput,
  VerifyRosterResult,
} from "@/types/api";
import { ApiError } from "./error";
import { notifySessionExpired } from "./session";
import type { Api } from "./types";

/**
 * 백엔드 없이 화면을 완성하기 위한 mock.
 *
 * ★ 성공 경로만 만들면 통합 때 무너진다 (docs/ops/INTEGRATION.md).
 *   실패 케이스를 반드시 함께 넣는다: 401 · 403 · 명단 불일치(단일 문구) ·
 *   토큰/코드 만료 · STORAGE_LIMIT · 업로드 실패 · 빈 목록.
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
              marks: [{ type: "link", attrs: { href: "/photos" } }],
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
 * 실제 수련회 사진 47장을 `frontend/mock-assets/photos/retreat-2026/`에 최적화해
 * 넣어뒀다 (원본 277MB → 7.3MB, WebP, **EXIF 제거**).
 *
 * ⚠️ **`public/`이 아니다.** `public/`은 인증 없이 정적 서빙되므로 얼굴이 식별되는
 *    사진이 URL로 새어나간다. `/mock-assets/*` route handler가 **개발 환경에서만**
 *    서빙한다 (PM 결정 2026-08-27, 1안). 배포에서는 404다 —
 *    **배포된 데모에서 사진첩 이미지가 안 보이는 것은 의도된 것이다.**
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
    thumbUrl: `/mock-assets/photos/retreat-2026/thumb/${slug}.webp`,
    viewUrl: `/mock-assets/photos/retreat-2026/view/${slug}.webp`,
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
/**
 * mock 설교 목록 — **실제 채널(`@light4402`)의 라이브 다시보기 14편**이다.
 *
 * ⚠️ 예전에는 존재하지 않는 영상 id(`mock-sermon-1` …)를 썼다. "썸네일 로드
 * 실패를 화면이 처리하는지 보려는 것"이 의도였지만, 실제로는 **배포된 mock
 * 빌드에서 썸네일이 한 장도 안 뜨는** 결과가 됐다 — 실패 처리를 확인하는
 * 대가로 정상 화면을 한 번도 못 보는 셈이었다.
 *
 * 그래서 뒤집었다: **기본은 실제 id로 정상 썸네일을 보여주고**, 실패 처리는
 * `?mock=broken-thumb` 시나리오로 확인한다. 이러면 둘 다 볼 수 있다.
 *
 * id·제목은 2026-09-01에 채널에서 직접 옮겼다. 실백엔드가 붙으면 이 배열은
 * 쓰이지 않는다.
 */
const REAL_STREAMS: { id: string; title: string; date: string }[] = [
  { id: "SaVEqB82v7Y", title: "하나님께 소망을 두고 있나요?", date: "2026-08-30" },
  { id: "aUMMywF--Q4", title: "세상을 비추는 빛", date: "2026-08-23" },
  { id: "85AkOKXSOe0", title: "빛나는 우리", date: "2026-08-16" },
  { id: "vARqPGsmDOc", title: "무너지는 나라", date: "2026-08-09" },
  { id: "TVoF19cUTPU", title: "주의 장막으로", date: "2026-08-02" },
  { id: "_Sr0mFypnj4", title: "주의 장막으로", date: "2026-07-19" },
  { id: "E57K1MhP4Y0", title: "사람을 향하신 주님", date: "2026-07-12" },
  { id: "8XyoMFMtIGE", title: "주께로 향하는 길", date: "2026-07-05" },
  { id: "s904Rs0EYHc", title: "하나님의 형상", date: "2026-06-28" },
  { id: "Mi92dcuXLr0", title: "함께 지어져", date: "2026-06-14" },
  { id: "qxcRYK_uKvA", title: "사랑", date: "2026-05-31" },
  { id: "U7LyLiAUjTU", title: "나와 함께", date: "2026-05-24" },
  { id: "xB_2qjbsiIg", title: "내 길을 즐거워할지어다", date: "2026-05-10" },
  { id: "Nv74ikPD22k", title: "아이처럼", date: "2026-05-02" },
];

const MOCK_SERMONS: Sermon[] = REAL_STREAMS.map(({ id, title, date }) => ({
  id,
  title,
  // 주일 14:00 KST = 05:00 UTC
  publishedAt: `${date}T05:00:00Z`,
  youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
  thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
}));

/**
 * 목록의 실제 출처.
 *
 * 하드코딩(`MOCK_SERMONS`)은 **2026-09-01의 스냅샷**이라 새 설교가 올라와도
 * 갱신되지 않는다. 그래서 먼저 우리 서버 라우트(`/sermons/feed` — 채널 RSS를
 * 읽는다)에 물어보고, **실패하면 스냅샷으로 내려앉는다**.
 *
 * 이 폴백이 중요하다: 오프라인·YouTube 장애·정적 export 어디서든 화면이
 * 비지 않는다. mock의 목적은 "백엔드 없이도 화면이 돈다"이므로 네트워크에
 * 의존하는 경로를 **필수로 만들면 안 된다.**
 *
 * 한 번 성공하면 세션 동안 재사용한다 — 목록 조회가 페이지마다 일어나는데
 * 매번 RSS를 다시 읽을 이유가 없다 (서버 쪽도 30분 캐시다).
 */
let sermonCache: Sermon[] | null = null;

async function sermonSource(): Promise<Sermon[]> {
  if (sermonCache) return sermonCache;
  if (typeof window === "undefined") return MOCK_SERMONS;

  try {
    const res = await fetch("/sermons/feed");
    if (res.ok) {
      const { items } = (await res.json()) as { items: Sermon[] };
      if (items.length > 0) {
        sermonCache = items;
        return items;
      }
    }
  } catch {
    // 폴백으로 넘어간다 — 화면에 에러를 띄울 일이 아니다
  }

  /*
    ⚠️ 폴백은 **캐시하지 않는다.** 캐시하면 한 번의 일시적 실패가 세션 내내
    옛 스냅샷을 고정한다 (YouTube가 서버 요청에 간헐적 404를 준다 —
    `app/sermons/feed/route.ts` 주석). 다음 조회에서 다시 시도하게 둔다.
  */
  return MOCK_SERMONS;
}

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

/** 업로드·기간수정으로 생기거나 바뀐 월례회. 같은 id면 이쪽이 이긴다 */
const dynamicMeetings: MeetingSummary[] = [];
/** 삭제된 월례회 id — 정적 mock 데이터는 지울 수 없으니 가려서 흉내낸다 */
const removedMeetingIds = new Set<string>();

/**
 * 열람 기간으로부터 `status`를 계산한다 (SPEC_API §7.1).
 *
 * mock 데이터에 `status`가 값으로 박혀 있지만 그대로 쓰지 않는다 — 그러면
 * **기간을 수정해도 상태가 안 바뀐다.** 종료된 자료의 기간을 늘려 다시 여는
 * 것(연장)이 §7.5의 핵심 용도인데, 그게 화면에서 확인되지 않으면 기간 수정
 * 기능을 검증할 수단이 없다. 실제 서버도 기간에서 상태를 파생한다.
 */
function meetingStatus(viewableFrom: string, viewableUntil: string): MeetingStatus {
  const now = Date.now();
  if (now < new Date(viewableFrom).getTime()) return "SCHEDULED";
  if (now > new Date(viewableUntil).getTime()) return "CLOSED";
  return "OPEN";
}

/**
 * 열람 종료가 시작보다 뒤인지 (SPEC_API §7.4 · §7.5의 `VALIDATION_ERROR`).
 * 화면에서도 막지만 서버가 최종 판단이라 mock도 같이 막는다 — 한쪽만 막으면
 * "화면에서는 되는데 서버에서 거부"가 통합 때 처음 드러난다.
 */
function validateMeetingWindow(viewableFrom: string, viewableUntil: string) {
  if (new Date(viewableUntil).getTime() <= new Date(viewableFrom).getTime()) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      message: "열람 종료는 시작보다 뒤여야 합니다.",
      status: 400,
      field: "viewableUntil",
    });
  }
}

/** 정적 + 동적을 합치고, 삭제된 것을 빼고, 상태를 기간에서 다시 계산한다 */
function mockMeetings(): MeetingSummary[] {
  const overridden = new Set(dynamicMeetings.map((m) => m.id));
  return [...dynamicMeetings, ...MEETINGS.filter((m) => !overridden.has(m.id))]
    .filter((m) => !removedMeetingIds.has(m.id))
    .map((m) => ({ ...m, status: meetingStatus(m.viewableFrom, m.viewableUntil) }))
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
}

/**
 * 열람 로그 mock (SPEC_API §7.7).
 *
 * 이름을 `김OO`처럼 가린 채로 둔다 — 이 화면은 실명과 마을이 함께 보이는
 * 자리라서, mock 데이터라도 진짜처럼 생긴 명단을 만들어두면 스크린샷이나
 * 데모에서 그대로 새어나간다.
 */
const MEETING_VIEWS: Record<string, MeetingView[]> = {
  "3": [
    { memberName: "김OO", village: "3", lastViewedAt: "2026-08-24T12:03:00Z", maxPageNo: 10 },
    { memberName: "이OO", village: "1", lastViewedAt: "2026-08-24T12:41:00Z", maxPageNo: 7 },
    { memberName: "박OO", village: "newcomer", lastViewedAt: "2026-08-25T01:12:00Z", maxPageNo: 2 },
    { memberName: "최OO", village: "5", lastViewedAt: "2026-08-25T02:30:00Z", maxPageNo: 10 },
  ],
  // 아직 아무도 안 본 자료 — 빈 목록도 화면이 처리해야 한다
  "4": [],
};

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

/** 로그인 테스트 계정 — 키는 loginId, 초기 비밀번호는 전부 `password12!` */
const MOCK_PASSWORD = "password12!";

/**
 * 계정별 비밀번호. 시드 계정은 여기 없으면 `MOCK_PASSWORD`로 친다.
 *
 * 상수 하나로 두면 "비밀번호가 변경되었습니다"를 띄운 직후 새 비밀번호로
 * 로그인이 실패한다 — 재설정·변경 흐름을 화면에서 끝까지 밟을 수 없다.
 */
const passwords = new Map<string, string>();

function passwordOf(loginId: string): string {
  return passwords.get(loginId) ?? MOCK_PASSWORD;
}
const MOCK_USERS: Record<string, AuthUser> = {
  doyeon01: {
    id: "42",
    name: "김도연a", // 동명이인 접미사 포함 그대로 (SPEC_API §2.1)
    loginId: "doyeon01",
    phone: "010-1111-2222",
    role: "MEMBER",
  },
  leader1: {
    id: "7",
    name: "박임원",
    loginId: "leader1",
    phone: "010-9999-0000",
    role: "LEADER",
  },
  pastor1: {
    id: "1",
    name: "최전도",
    loginId: "pastor1",
    phone: "010-7777-8888",
    role: "PASTOR",
  },
};

/** 이번 세션 중 가입한 계정 — 새로고침하면 사라진다 (실제 DB 아님) */
const dynamicUsers: Record<string, AuthUser> = {};

function findUserByLoginId(loginId: string): AuthUser | undefined {
  return MOCK_USERS[loginId] ?? dynamicUsers[loginId];
}

/**
 * 교회 명단 mock (member_roster) — verify-roster가 대조하는 원본.
 *
 * · `김도연a`는 이미 가입돼 있다(doyeon01) → 다시 확인하면 "이미 계정 있음"인데,
 *   응답은 불일치와 같은 단일 문구다 (SPEC_API §2.1)
 * · `김도연b`는 미가입 동명이인 — 접미사를 정확히 입력해야 통과한다
 * · `이중복` 2건은 명단 데이터 결함 시나리오 — 셋 다 일치가 2건 이상이면
 *   VALIDATION_ERROR("임원에게 문의")를 돌려준다
 */
type MockRosterEntry = {
  rosterId: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  phone: string;
  /** 마을 — 출석부가 마을 그룹으로 돈다. 인증 대조에는 쓰지 않는다 */
  village: Village;
  /** 가입된 계정의 loginId — null이면 미가입(재개방 포함) */
  claimedBy: string | null;
};

/**
 * ⚠️ 인증(verify-roster)과 출석부가 **같은 명단**을 쓴다 — 실제 모델도
 * member_roster 하나다. 전원 가상 인물이며 실명·실연락처를 넣지 않는다
 * (`infra/vercel/README.md §3`). 출석부 응답에는 전화번호를 싣지 않는다.
 */
const MOCK_ROSTER: MockRosterEntry[] = [
  { rosterId: "r01", name: "강하늘", birthDate: "2000-01-05", phone: "010-1000-0001", village: "1", claimedBy: null },
  { rosterId: "r02", name: "김보라", birthDate: "2001-02-14", phone: "010-1000-0002", village: "1", claimedBy: null },
  { rosterId: "r03", name: "박새벽", birthDate: "1998-05-21", phone: "010-1000-0003", village: "1", claimedBy: null },
  { rosterId: "r04", name: "이한별", birthDate: "2003-08-09", phone: "010-1000-0004", village: "1", claimedBy: null },
  { rosterId: "r05", name: "정미르", birthDate: "1999-12-30", phone: "010-1000-0005", village: "2", claimedBy: null },
  { rosterId: "r06", name: "최나래", birthDate: "2002-04-17", phone: "010-1000-0006", village: "2", claimedBy: null },
  { rosterId: "r07", name: "한가람", birthDate: "2000-10-02", phone: "010-1000-0007", village: "2", claimedBy: null },
  { rosterId: "r08", name: "윤슬기", birthDate: "2001-06-25", phone: "010-1000-0008", village: "2", claimedBy: null },
  { rosterId: "r09", name: "서도담", birthDate: "1997-03-11", phone: "010-1000-0009", village: "3", claimedBy: null },
  { rosterId: "r10", name: "임누리", birthDate: "2004-01-19", phone: "010-1000-0010", village: "3", claimedBy: null },
  { rosterId: "r11", name: "오아람", birthDate: "2002-09-08", phone: "010-1000-0011", village: "3", claimedBy: null },
  { rosterId: "r12", name: "신바다", birthDate: "1999-07-04", phone: "010-1000-0012", village: "4", claimedBy: null },
  { rosterId: "r13", name: "문소리", birthDate: "2000-11-23", phone: "010-1000-0013", village: "4", claimedBy: null },
  { rosterId: "r14", name: "장여울", birthDate: "2003-02-28", phone: "010-1000-0014", village: "4", claimedBy: null },
  { rosterId: "r15", name: "배이든", birthDate: "2001-08-15", phone: "010-1000-0015", village: "4", claimedBy: null },
  // 가입(verify-roster) 시나리오 전용 케이스
  { rosterId: "r16", name: "김도연a", birthDate: "2001-03-14", phone: "010-1111-2222", village: "3", claimedBy: "doyeon01" }, // 이미 가입됨 → 단일 문구 실패
  { rosterId: "r17", name: "김도연b", birthDate: "1999-07-01", phone: "010-3333-4444", village: "5", claimedBy: null }, // 미가입 동명이인 — 접미사 정확히 입력해야 통과
  { rosterId: "r18", name: "이믿음", birthDate: "2002-11-23", phone: "010-5555-6666", village: "5", claimedBy: null }, // 정상 가입 경로
  { rosterId: "r19", name: "이중복", birthDate: "2000-01-01", phone: "010-7777-0000", village: "5", claimedBy: null }, // 명단 결함(2건) → 임원 문의
  { rosterId: "r20", name: "이중복", birthDate: "2000-01-01", phone: "010-7777-0000", village: "5", claimedBy: null },
];

/** verify-roster가 발급한 registrationToken — 1회용 · 5분 (SPEC_API §2.1) */
const issuedRegistrationTokens = new Map<string, { entry: MockRosterEntry; expiresAt: number }>();

/** 전도사가 발급한 비밀번호 리셋 코드 — loginId → 코드 (SPEC_API §8.4) */
const issuedResetCodes = new Map<string, { resetCode: string; expiresAt: number }>();

const digitsOnly = (v: string) => v.replace(/\D/g, "");

function toLoginResult(user: AuthUser): LoginResult {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
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
/**
 * 서버가 알고 있는 첨부 전체 — id로 조회할 수 있는 것들.
 *
 * 이름 그대로 "방금 업로드한 것"만 담아뒀더니 **글 수정이 깨졌다.**
 * 수정 화면은 기존 첨부 id를 그대로 다시 보내는데, 그 id는 이 브라우저
 * 세션에서 업로드한 적이 없어서 `validatePostInput`의 "업로드되지 않은
 * 첨부" 검사에 걸렸다. 실제 서버는 DB에 있는 첨부를 당연히 알고 있으므로
 * 그쪽이 맞다 — mock이 서버보다 좁았던 것이다.
 * 그래서 정적 mock 글에 붙어 있는 첨부도 처음부터 여기 등록해둔다.
 */
const uploadedAttachments = new Map<string, PostAttachment>();
for (const detail of Object.values(NOTICE_DETAILS)) {
  for (const a of detail.attachments) uploadedAttachments.set(a.id, a);
}

/** 정적 + 동적 mock 글을 하나로 합친다. 같은 id는 **동적 쪽이 이긴다**(수정 반영) */
function mockPostSummaries(): PostSummary[] {
  const overridden = new Set(dynamicPosts.map((p) => p.summary.id));
  return [
    ...dynamicPosts.map((p) => p.summary),
    ...NOTICES.filter((n) => !overridden.has(n.id)),
  ].filter((p) => !removedPostIds.has(p.id));
}

/**
 * 예산안(`BUDGET`)은 임원 이상 전용이다 — 헌금·지출 내역이 담기기 때문.
 * (내부공지·회의록은 회원 `M` — SPEC_API §3.1 v1.3, 2026-08-31)
 */
function isLeaderSession(): boolean {
  const user = readSession();
  return user?.role === "LEADER" || user?.role === "PASTOR";
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
      // `validatePostInput`이 모르는 id를 이미 막지만, 여기서도 걸러낸다 —
      // 검사를 한 곳이라도 놓치면 `undefined`가 목록에 섞여 렌더가 깨진다
      attachments: input.attachmentIds
        .map((aid) => uploadedAttachments.get(aid))
        .filter((a): a is PostAttachment => a !== undefined),
    },
  };
}

// ── 사진 업로드 mock (SPEC_API §6.5 · §6.6) ────────────────
/**
 * mock은 R2가 없다. 그래서 presigned URL 대신 `mock://` URL을 발급하고,
 * `uploads.put`이 blob을 **objectURL로 붙잡아둔다** — 그러면 commit 후 앨범
 * 그리드에 방금 올린 사진이 실제로 보인다. 이게 없으면 "업로드 성공"만 뜨고
 * 화면에는 아무 변화가 없어서, 큐가 제대로 도는지 눈으로 확인할 수 없다.
 *
 * ⚠️ objectURL은 이 문서(탭)에서만 유효하다. 새로고침하면 사라진다 —
 *    `dynamicAlbums`와 같은 mock의 한계다.
 */
type MockPendingUpload = {
  albumId: string;
  width: number;
  height: number;
  takenAt: string | null;
  /** put이 실제로 들어왔을 때만 채워진다 — 없으면 commit이 OBJECT_NOT_FOUND다 */
  viewObjectUrl?: string;
  thumbObjectUrl?: string;
};

/** photoId → 발급됐지만 아직 commit되지 않은 업로드 (실서비스의 `PENDING` 행) */
const mockPendingUploads = new Map<string, MockPendingUpload>();
/** albumId → 이번 세션에 업로드한 사진 (최신 먼저) */
const mockUploadedPhotos = new Map<string, Photo[]>();

let mockPhotoIdSeq = 900;

/** `mock://uploads/{photoId}/{view|thumb}` */
const MOCK_PUT_URL_RE = /^mock:\/\/uploads\/(\d+)\/(view|thumb)$/;

// ── 주보 업로드 mock (SPEC_API §5.4 · §5.5) ─────────────────
/**
 * 이번 세션에 업로드한 주보. 페이지 URL은 업로드한 blob의 objectURL이라
 * **새로고침하면 사라진다** (`dynamicAlbums`·`mockUploadedPhotos`와 같은 한계).
 *
 * 이렇게까지 하는 이유: 업로드 후 뷰어에 실제로 뜨는지 봐야 순서(페이지 번호)가
 * 제대로 갔는지 확인할 수 있다. FR-BUL-05의 핵심이 순서다.
 */
type MockBulletin = {
  id: string;
  serviceDate: string;
  pages: Bulletin["pages"];
  thumbUrl: string;
};

const dynamicBulletins: MockBulletin[] = [];
/** 삭제된 고정 mock 주보 id — 정적 파일은 지울 수 없으니 가려서 흉내낸다 */
const removedMockBulletinIds = new Set<string>();
let mockBulletinIdSeq = 12;

/** 동적 + 정적 주보를 **주일 날짜 최신순**으로 합친다 (`latest`가 이 순서에 의존한다) */
function allMockBulletins(): MockBulletin[] {
  const seeded: MockBulletin[] = BULLETIN_DATES.map((entry) => ({
    id: entry.id,
    serviceDate: entry.date,
    pages: bulletinOf(entry).pages,
    thumbUrl: `/bulletins/${entry.date}-thumb.webp`,
  }));

  return [...dynamicBulletins, ...seeded]
    .filter((b) => !removedMockBulletinIds.has(b.id))
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
}


// ── 출석부 mock (브리핑 2026-08-28 §7 초안 · SPEC_API 미반영) ──────────

// 명단은 인증 mock과 공유한다 — 위 MOCK_ROSTER (member_roster 하나가 원본이다).

type MockAttendanceSession = {
  id: string;
  date: string;
  type: AttendanceSessionType;
  title: string;
  /** rosterId → status. 없는 키 = 미체크(null) — "기록 없음"과 ABSENT는 다르다 */
  entries: Map<string, AttendanceStatus>;
};

/** 이번 세션 중 만든 회차 포함. 새로고침하면 시드로 돌아간다 (dynamicAlbums와 같은 원칙) */
const dynamicAttendanceSessions: MockAttendanceSession[] = [
  {
    // 체크가 끝난 지난 회차 — 목록에서 "15/15" 완료 상태를 보여주기 위한 시드
    id: "as-1",
    date: "2026-08-17",
    type: "SUNDAY_SERVICE",
    title: "주일예배",
    entries: new Map([
      ["r01", "PRESENT"], ["r02", "PRESENT"], ["r03", "LATE"], ["r04", "PRESENT"],
      ["r05", "PRESENT"], ["r06", "ABSENT"], ["r07", "PRESENT"], ["r08", "EXCUSED"],
      ["r09", "PRESENT"], ["r10", "PRESENT"], ["r11", "ABSENT"], ["r12", "PRESENT"],
      ["r13", "PRESENT"], ["r14", "LATE"], ["r15", "PRESENT"],
    ]),
  },
  {
    // 체크 중인 회차 — 일부만 기록된 상태(마을 1만 끝남)를 보여주기 위한 시드
    id: "as-2",
    date: "2026-08-24",
    type: "SUNDAY_SERVICE",
    title: "주일예배",
    entries: new Map([
      ["r01", "PRESENT"], ["r02", "PRESENT"], ["r03", "PRESENT"], ["r04", "ABSENT"],
    ]),
  },
];

let attendanceSessionSeq = 100;

/** 출석부는 전부 임원(`L`) 이상이다 (§7 · 인가 매트릭스 §3) */
function requireAttendanceLeader(): AuthUser {
  const user = requireSession();
  if (user.role !== "LEADER" && user.role !== "PASTOR") {
    throw new ApiError({
      code: "FORBIDDEN",
      message: "출석부는 임원 이상만 사용할 수 있습니다.",
      status: 403,
    });
  }
  return user;
}

/** 마을(숫자, newcomer는 뒤로) → 이름 순 — 체크 화면이 마을 단위로 돈다 */
function rosterSorted(): MockRosterEntry[] {
  return [...MOCK_ROSTER].sort((a, b) => {
    if (a.village !== b.village) {
      if (a.village === "newcomer") return 1;
      if (b.village === "newcomer") return -1;
      return Number(a.village) - Number(b.village);
    }
    return a.name.localeCompare(b.name, "ko");
  });
}

function toAttendanceSummary(s: MockAttendanceSession): AttendanceSessionSummary {
  let present = 0;
  for (const status of s.entries.values()) {
    if (status === "PRESENT") present += 1;
  }
  return {
    id: s.id,
    date: s.date,
    type: s.type,
    title: s.title,
    checkedCount: s.entries.size,
    presentCount: present,
    rosterCount: MOCK_ROSTER.length,
  };
}

export const mockApi: Api = {
  posts: {
    async list({ category, page = 0, size = 20 }): Promise<Page<PostSummary>> {
      await delay();
      throwIfScenario();

      // 예산안은 임원 이상 — 로그인해도 안 되는 경우라 403이다 (§10 주의 3)
      if (category === "BUDGET" && !isLeaderSession()) {
        throw new ApiError({
          code: "FORBIDDEN",
          message: "예산안을 열람할 권한이 없습니다.",
          status: 403,
        });
      }
      // 내부공지·회의록은 회원 전용 (SPEC_API §3.1 v1.3) — 익명은 401(로그인 유도)
      if ((category === "NOTICE_MEMBER" || category === "MINUTES") && !readSession()) {
        throw new ApiError({
          code: "UNAUTHORIZED",
          message: "로그인이 필요합니다.",
          status: 401,
        });
      }

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

      // 예산안은 임원 이상만. 권한이 없으면 **존재 자체를 숨긴다**(404) —
      // 403은 "그 문서가 있긴 하다"를 알려주는 셈이다 (SPEC_API §3.3).
      if (summary.category === "BUDGET" && !isLeaderSession()) {
        throw new ApiError({
          code: "NOT_FOUND",
          message: "글을 찾을 수 없습니다.",
          status: 404,
        });
      }
      // 내부공지·회의록 상세는 회원 전용 (SPEC_API §3.1 v1.3) — 401이면
      // `/news/[slug]` 서버 렌더가 클라이언트 분기로 넘어간다
      if (
        (summary.category === "NOTICE_MEMBER" || summary.category === "MINUTES") &&
        !readSession()
      ) {
        throw new ApiError({
          code: "UNAUTHORIZED",
          message: "로그인이 필요합니다.",
          status: 401,
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
      // 사진첩 열람은 회원 전용 (SPEC_API §10 v1.3 — 8/25 공개 전환의 부분 철회)
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
      // 사진첩 열람은 회원 전용 (SPEC_API §10 v1.3)
      requireSession();

      const known = [...dynamicAlbums, ...ALBUMS].find((a) => a.id === albumId);
      if (!known) {
        throw new ApiError({ code: "NOT_FOUND", message: "앨범을 찾을 수 없습니다.", status: 404 });
      }

      // 사진이 있는 앨범은 5번뿐 — 나머지는 빈 목록(화면이 처리해야 하는 상태)
      const seeded = albumId === "5" && scenario() !== "empty" ? RETREAT_PHOTOS : [];
      // 이번 세션에 업로드한 사진을 앞에 붙인다 (최신순) — 업로드 결과를 앨범에서
      // 실제로 확인할 수 있어야 큐가 제대로 돌았는지 알 수 있다
      const source = [...(mockUploadedPhotos.get(albumId) ?? []), ...seeded];

      // 커서는 불투명한 문자열이어야 한다 (SPEC_API §1.6). 오프셋을 감싸 흉내낸다
      const offset = cursor ? Number(atob(cursor)) || 0 : 0;
      const items = source.slice(offset, offset + size);
      const next = offset + items.length;
      const hasNext = next < source.length;

      return { items, nextCursor: hasNext ? btoa(String(next)) : null, hasNext };
    },

    async remove(albumId: string): Promise<void> {
      await delay();
      throwIfScenario();
      const user = requireSession();

      // SPEC_API §6.3 — 권한 `L`. 되돌릴 수 없는 동작이라 서버가 반드시 막는다
      if (user.role !== "LEADER" && user.role !== "PASTOR") {
        throw new ApiError({
          code: "FORBIDDEN",
          message: "앨범을 삭제할 권한이 없습니다.",
          status: 403,
        });
      }
      const idx = dynamicAlbums.findIndex((a) => a.id === albumId);
      if (idx >= 0) {
        dynamicAlbums.splice(idx, 1);
        return;
      }
      if (!ALBUMS.some((a) => a.id === albumId)) {
        throw new ApiError({ code: "NOT_FOUND", message: "앨범을 찾을 수 없습니다.", status: 404 });
      }
      // 고정 mock 앨범은 실제로 지우지 않는다 (새로고침 시 되살아나 혼란을 준다)
    },

  },
  uploads: {
    async issue(input: UploadIssueInput): Promise<{ uploads: UploadTicket[] }> {
      await delay();
      // `?mock=storage`가 STORAGE_LIMIT(409)을 던진다 — 업로드 차단 화면 확인용
      throwIfScenario();
      requireLeader("사진을 올릴 권한이 없습니다.");

      if (![...dynamicAlbums, ...ALBUMS].some((a) => a.id === input.albumId)) {
        throw new ApiError({
          code: "NOT_FOUND",
          message: "앨범을 찾을 수 없습니다.",
          status: 404,
        });
      }
      if (input.files.length === 0) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "올릴 사진이 없습니다.",
          status: 400,
          field: "files",
        });
      }

      const uploads = input.files.map((file) => {
        mockPhotoIdSeq += 1;
        const photoId = `${mockPhotoIdSeq}`;
        mockPendingUploads.set(photoId, {
          albumId: input.albumId,
          width: file.width,
          height: file.height,
          takenAt: file.takenAt,
        });
        return {
          clientId: file.clientId,
          photoId,
          viewPutUrl: `mock://uploads/${photoId}/view`,
          thumbPutUrl: `mock://uploads/${photoId}/thumb`,
          expiresIn: 900,
        };
      });

      return { uploads };
    },

    async put(url, body, options): Promise<void> {
      const matched = MOCK_PUT_URL_RE.exec(url);
      if (!matched) throw new Error("발급되지 않은 업로드 URL입니다.");
      const [, photoId, variant] = matched;

      const pending = mockPendingUploads.get(photoId);
      // 실서비스에서 서명이 만료(15분)된 상황에 해당한다
      if (!pending) throw new Error("업로드 URL이 만료되었습니다 (403).");

      // 진행률이 실제로 움직이는지 눈으로 확인할 수 있어야 한다
      for (const percent of [20, 55, 85]) {
        if (options?.signal?.aborted) throw new Error("업로드가 취소되었습니다.");
        await delay(60);
        options?.onProgress?.(percent);
      }

      /*
        ★ 실패 케이스 (docs/ops/INTEGRATION.md — 성공 경로만 만들면 통합 때 무너진다).
        `?mock=upload-fail`이면 photoId 4의 배수만 실패시킨다. 전부 실패시키면
        "부분 실패 재시도"(FR-PHO-08)를 확인할 수 없다 — 정확히 이 UI가 존재하는
        이유가 243장 중 2장이 실패하는 상황이다.
      */
      if (scenario() === "upload-fail" && Number(photoId) % 4 === 0) {
        throw new Error("전송에 실패했습니다 (500).");
      }

      await delay(60);
      options?.onProgress?.(100);

      // blob을 붙잡아둔다 (위 주석 참고). 서버 환경에는 objectURL이 없다
      if (typeof URL.createObjectURL === "function") {
        const objectUrl = URL.createObjectURL(body);
        if (variant === "view") pending.viewObjectUrl = objectUrl;
        else pending.thumbObjectUrl = objectUrl;
      }
    },

    async commit(photoIds): Promise<UploadCommitResult> {
      await delay();
      throwIfScenario();
      requireLeader("사진을 올릴 권한이 없습니다.");

      const committed: string[] = [];
      const failed: UploadCommitResult["failed"] = [];

      for (const photoId of photoIds) {
        const pending = mockPendingUploads.get(photoId);
        // 객체가 R2에 없으면 서버는 COMMITTED로 바꾸지 않는다 (SPEC_API §6.6)
        if (!pending || !pending.viewObjectUrl || !pending.thumbObjectUrl) {
          failed.push({ photoId, reason: "OBJECT_NOT_FOUND" });
          continue;
        }

        const photo: Photo = {
          id: photoId,
          thumbUrl: pending.thumbObjectUrl,
          viewUrl: pending.viewObjectUrl,
          width: pending.width,
          height: pending.height,
          takenAt: pending.takenAt,
        };
        const existing = mockUploadedPhotos.get(pending.albumId) ?? [];
        mockUploadedPhotos.set(pending.albumId, [photo, ...existing]);

        // 앨범 목록의 장수·커버도 따라 움직여야 화면이 앞뒤가 맞는다
        const album = [...dynamicAlbums, ...ALBUMS].find((a) => a.id === pending.albumId);
        if (album) {
          album.photoCount += 1;
          album.coverThumbUrl ??= photo.thumbUrl;
        }

        mockPendingUploads.delete(photoId);
        committed.push(photoId);
      }

      return { committed, failed };
    },
  },
  photos: {
    async report(photoId: string, input: { reason: string }): Promise<void> {
      await delay();
      throwIfScenario();
      // 사진첩이 회원 전용으로 돌아오면서(2026-08-31) 신고도 회원만 —
      // 사진을 볼 수 있어야 신고할 수 있다 (SPEC_API §10 매트릭스: report M)
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

    async remove(photoId: string): Promise<void> {
      await delay();
      throwIfScenario();
      const user = requireSession();

      // SPEC_API §6.9 — 권한 `L`
      if (user.role !== "LEADER" && user.role !== "PASTOR") {
        throw new ApiError({
          code: "FORBIDDEN",
          message: "사진을 삭제할 권한이 없습니다.",
          status: 403,
        });
      }
      if (!RETREAT_PHOTOS.some((p) => p.id === photoId)) {
        throw new ApiError({ code: "NOT_FOUND", message: "사진을 찾을 수 없습니다.", status: 404 });
      }
      // mock은 정적 자산이라 실제로 지우지 않는다 — 화면은 성공으로 처리하고
      // 목록을 다시 불러오면 사진이 그대로 있다. 통합 시 실제 삭제로 검증해야 한다
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
      // 월례회 열람은 회원 전용 (SPEC_API §10 v1.3)
      requireSession();

      const all = scenario() === "empty" ? [] : mockMeetings();
      return { items: all.slice(page * size, (page + 1) * size), page, size, hasNext: false };
    },

    async get(id: string): Promise<MeetingDetail> {
      await delay();
      throwIfScenario();
      // 월례회 열람은 회원 전용 (SPEC_API §10 v1.3) — 세션은 임원 우회 판정에도 쓴다
      const user = requireSession();

      const m = mockMeetings().find((x) => x.id === id);
      if (!m) {
        throw new ApiError({ code: "NOT_FOUND", message: "자료를 찾을 수 없습니다.", status: 404 });
      }

      // SPEC_API §7.1: `L` 이상은 status와 무관하게 열람 가능 (익명은 OPEN만)
      const isLeader = user != null && (user.role === "LEADER" || user.role === "PASTOR");
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

    async create(
      input: MeetingCreateInput,
      options?: { onUploadProgress?: (percent: number) => void },
    ): Promise<{ id: string; pageCount: number }> {
      throwIfScenario();
      requireLeader("월례회 자료 업로드 권한이 없습니다.");
      validateMeetingWindow(input.viewableFrom, input.viewableUntil);

      /*
        PDF가 맞는지만 본다. **암호화·손상 PDF는 mock이 판별할 수 없다** —
        그건 서버가 PDFBox로 열어봐야 아는 것이라서, 여기서 통과했다고
        실제로 변환된다는 뜻이 아니다 (화면에도 그렇게 적는다).
      */
      const isPdf =
        input.file.type === "application/pdf" ||
        input.file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "PDF 파일만 올릴 수 있습니다. Word에서 「PDF로 저장」해 주세요.",
          status: 400,
          field: "file",
        });
      }

      /*
        ★ 서버는 여기서 PDF를 페이지 이미지로 **동기 변환**하며 10페이지
          기준 15~30초가 걸린다 (SPEC_API §7.4). mock에는 변환할 것이 없지만
          그 대기만은 흉내낸다 — 진행 표시가 실제로 버티는지, 사용자가 그
          사이 이탈하려 할 때 경고가 뜨는지를 확인할 수 있어야 한다.
          실제 15초를 그대로 기다리면 개발이 불가능해 6초로 압축했다.
          **화면 문구는 압축값이 아니라 실제 소요(15~30초)를 안내한다.**
      */
      /*
        전송 구간 — 실제로는 브라우저가 파일을 밀어 올리는 시간이다.
        mock에는 올릴 곳이 없으니 0→100을 짧게 훑는다. 이 구간의 진행률은
        **실제 서버에서도 진짜 값**이다(XHR이 알려준다) — 지어내는 건 mock의
        타이밍뿐이고, 화면이 읽는 값의 의미는 같다.
      */
      for (let p = 0; p <= 100; p += 10) {
        options?.onUploadProgress?.(p);
        await delay(60);
      }

      await delay(6000);

      // 변환 결과 페이지 수는 서버만 안다. mock은 지어내되 고정값을 쓴다
      const pageCount = 10;
      const id = `m-${dynamicMeetings.length + 1}-${Date.now()}`;
      dynamicMeetings.unshift({
        id,
        title: input.title.trim(),
        meetingDate: input.meetingDate,
        pageCount,
        viewableFrom: input.viewableFrom,
        viewableUntil: input.viewableUntil,
        status: meetingStatus(input.viewableFrom, input.viewableUntil),
      });
      return { id, pageCount };
    },

    async updateWindow(id: string, input: MeetingWindowInput): Promise<void> {
      await delay();
      throwIfScenario();
      requireLeader("열람 기간 수정 권한이 없습니다.");
      validateMeetingWindow(input.viewableFrom, input.viewableUntil);

      const existing = mockMeetings().find((m) => m.id === id);
      if (!existing) {
        throw new ApiError({ code: "NOT_FOUND", message: "자료를 찾을 수 없습니다.", status: 404 });
      }

      const next: MeetingSummary = {
        ...existing,
        viewableFrom: input.viewableFrom,
        viewableUntil: input.viewableUntil,
        status: meetingStatus(input.viewableFrom, input.viewableUntil),
      };
      const at = dynamicMeetings.findIndex((m) => m.id === id);
      if (at >= 0) dynamicMeetings[at] = next;
      else dynamicMeetings.unshift(next);
    },

    async remove(id: string): Promise<void> {
      await delay();
      throwIfScenario();
      requireLeader("월례회 자료 삭제 권한이 없습니다.");

      if (!mockMeetings().some((m) => m.id === id)) {
        throw new ApiError({ code: "NOT_FOUND", message: "자료를 찾을 수 없습니다.", status: 404 });
      }
      removedMeetingIds.add(id);
      const at = dynamicMeetings.findIndex((m) => m.id === id);
      if (at >= 0) dynamicMeetings.splice(at, 1);
    },

    async views(
      id: string,
      { page = 0, size = 20 }: { page?: number; size?: number } = {},
    ): Promise<Page<MeetingView> & { totalViewers: number }> {
      await delay();
      throwIfScenario();
      requireLeader("열람 로그 조회 권한이 없습니다.");

      if (!mockMeetings().some((m) => m.id === id)) {
        throw new ApiError({ code: "NOT_FOUND", message: "자료를 찾을 수 없습니다.", status: 404 });
      }

      const all = scenario() === "empty" ? [] : (MEETING_VIEWS[id] ?? []);
      return {
        items: all.slice(page * size, (page + 1) * size),
        page,
        size,
        hasNext: (page + 1) * size < all.length,
        totalViewers: all.length,
      };
    },
  },
  admin: {
    async members({ q, page = 0, size = 20 } = {}): Promise<Page<AdminMember>> {
      await delay();
      throwIfScenario();
      const user = requireSession();

      // SPEC_API §8.1 — 권한 `T`(PASTOR)만
      if (user.role !== "PASTOR") {
        throw new ApiError({ code: "FORBIDDEN", message: "권한이 없습니다.", status: 403 });
      }

      const all: AdminMember[] = [...Object.values(MOCK_USERS), ...Object.values(dynamicUsers)].map(
        (u) => ({
          id: u.id,
          name: u.name,
          loginId: u.loginId,
          phone: u.phone,
          role: u.role,
          createdAt: "2026-08-19T09:00:00Z",
        }),
      );

      let items = all;
      if (q?.trim()) items = items.filter((m) => m.name.includes(q.trim()));
      if (scenario() === "empty") items = [];

      return { items: items.slice(page * size, (page + 1) * size), page, size, hasNext: false };
    },

    /**
     * SPEC_API §8.2 — 계정 삭제 + 명단 재개방 (선점 복구 절차).
     * mock에서도 claimed 해제를 실제로 해야 "삭제 후 재가입" 흐름을
     * 화면에서 끝까지 밟아볼 수 있다.
     */
    async deleteMember(id: string, input: { reason: string }): Promise<void> {
      await delay();
      throwIfScenario();
      const user = requireSession();
      if (user.role !== "PASTOR") {
        throw new ApiError({ code: "FORBIDDEN", message: "권한이 없습니다.", status: 403 });
      }
      if (!input.reason.trim()) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "삭제 사유를 입력해주세요.",
          status: 400,
          field: "reason",
        });
      }
      const target = [...Object.values(MOCK_USERS), ...Object.values(dynamicUsers)].find(
        (u) => u.id === id,
      );
      if (!target) {
        throw new ApiError({ code: "NOT_FOUND", message: "회원을 찾을 수 없습니다.", status: 404 });
      }
      if (target.loginId) {
        // 시드 계정(MOCK_USERS)도 지운다. dynamicUsers만 지우면 `doyeon01` 같은
        // 시드가 "삭제 성공" 뒤에도 목록에 남고, 명단만 열려 상태가 어긋난다.
        delete dynamicUsers[target.loginId];
        delete MOCK_USERS[target.loginId];
        passwords.delete(target.loginId);
        const rosterEntry = MOCK_ROSTER.find((r) => r.claimedBy === target.loginId);
        if (rosterEntry) rosterEntry.claimedBy = null;
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

    /** SPEC_API §8.4 — 리셋 코드 발급 (1회용·30분). 코드는 화면에 표시해 구두/문자 전달 */
    async issuePasswordResetCode(id: string): Promise<PasswordResetCode> {
      await delay();
      throwIfScenario();
      const user = requireSession();
      if (user.role !== "PASTOR") {
        throw new ApiError({ code: "FORBIDDEN", message: "권한이 없습니다.", status: 403 });
      }
      const target = [...Object.values(MOCK_USERS), ...Object.values(dynamicUsers)].find(
        (u) => u.id === id,
      );
      if (!target) {
        throw new ApiError({ code: "NOT_FOUND", message: "회원을 찾을 수 없습니다.", status: 404 });
      }
      if (!target.loginId) {
        // 카카오 가입자는 비밀번호가 없다 — 카카오 로그인이 자력 수단 (SPEC_API §2.9)
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "카카오로 가입한 회원입니다. 카카오 로그인을 안내해주세요.",
          status: 400,
          field: null,
        });
      }
      const resetCode = `${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;
      const expiresAt = Date.now() + 30 * 60 * 1000;
      issuedResetCodes.set(target.loginId, { resetCode, expiresAt });
      return { resetCode, expiresAt: new Date(expiresAt).toISOString() };
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
  attendance: {
    async sessions({ page = 0, size = 20 } = {}): Promise<Page<AttendanceSessionSummary>> {
      await delay();
      throwIfScenario();
      requireAttendanceLeader();

      const all = scenario() === "empty" ? [] : [...dynamicAttendanceSessions];
      // 최신 날짜부터 — 임원이 여는 것은 거의 항상 "이번 주" 회차다
      all.sort((a, b) => b.date.localeCompare(a.date));
      return {
        items: all.slice(page * size, (page + 1) * size).map(toAttendanceSummary),
        page,
        size,
        hasNext: all.length > (page + 1) * size,
      };
    },

    async createSession(input: AttendanceSessionInput): Promise<{ id: string }> {
      await delay();
      throwIfScenario();
      requireAttendanceLeader();

      if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.date)) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "날짜를 선택해주세요.",
          status: 400,
          field: "date",
        });
      }
      if (!input.title.trim()) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "회차 이름을 입력해주세요.",
          status: 400,
          field: "title",
        });
      }
      // 같은 날짜·같은 종류 중복 방지 — 실수로 두 번 만들면 출결이 갈라진다
      if (dynamicAttendanceSessions.some((s) => s.date === input.date && s.type === input.type)) {
        throw new ApiError({
          code: "DUPLICATE",
          message: "같은 날짜에 이미 회차가 있습니다.",
          status: 409,
          field: "date",
        });
      }

      attendanceSessionSeq += 1;
      const id = "as-" + attendanceSessionSeq;
      dynamicAttendanceSessions.push({
        id,
        date: input.date,
        type: input.type,
        title: input.title.trim(),
        entries: new Map(),
      });
      return { id };
    },

    async session(id: string): Promise<AttendanceSessionDetail> {
      await delay();
      throwIfScenario();
      requireAttendanceLeader();

      const found = dynamicAttendanceSessions.find((s) => s.id === id);
      if (!found) {
        throw new ApiError({ code: "NOT_FOUND", message: "회차를 찾을 수 없습니다.", status: 404 });
      }
      return {
        id: found.id,
        date: found.date,
        type: found.type,
        title: found.title,
        entries: rosterSorted().map((row) => ({
          rosterId: row.rosterId,
          name: row.name,
          village: row.village,
          status: found.entries.get(row.rosterId) ?? null,
        })),
      };
    },

    async saveEntries(id: string, entries: AttendanceEntryInput[]): Promise<void> {
      await delay();
      throwIfScenario();
      requireAttendanceLeader();

      const found = dynamicAttendanceSessions.find((s) => s.id === id);
      if (!found) {
        throw new ApiError({ code: "NOT_FOUND", message: "회차를 찾을 수 없습니다.", status: 404 });
      }
      // ⚠️ upsert — 보낸 것만 덮는다 (§7). 전체 교체로 만들면 동시에 체크하는
      //    다른 임원의 기록을 지운다. mock도 같은 의미론을 흉내내야 화면이
      //    "손댄 것만 보내는" 방식을 검증할 수 있다.
      for (const entry of entries) {
        if (!MOCK_ROSTER.some((r) => r.rosterId === entry.rosterId)) {
          throw new ApiError({
            code: "VALIDATION_ERROR",
            message: "명단에 없는 사람입니다.",
            status: 400,
            field: "rosterId",
          });
        }
        found.entries.set(entry.rosterId, entry.status);
      }
    },

    async removeSession(id: string): Promise<void> {
      await delay();
      throwIfScenario();
      requireAttendanceLeader();

      const idx = dynamicAttendanceSessions.findIndex((s) => s.id === id);
      if (idx < 0) {
        throw new ApiError({ code: "NOT_FOUND", message: "회차를 찾을 수 없습니다.", status: 404 });
      }
      dynamicAttendanceSessions.splice(idx, 1);
    },
  },
  sermons: {
    /**
     * mock 설교 목록. 화면에 있던 더미 배열을 여기로 옮겼다 — 화면이 자기
     * 데이터를 들고 있으면 API가 붙는 날 화면도 같이 고쳐야 한다.
     *
     * `?mock=broken-thumb` — 썸네일 URL을 존재하지 않는 id로 바꾼다.
     * 화면의 로드 실패 처리(`▶ 영상 보기` 자리표시자)를 확인하는 시나리오다.
     */
    async list({ page = 0, size = 12 } = {}): Promise<Page<Sermon>> {
      await delay();
      throwIfScenario();

      const base = scenario() === "empty" ? [] : await sermonSource();
      const all: Sermon[] =
        scenario() === "broken-thumb"
          ? base.map((s) => ({
              ...s,
              thumbnailUrl: "https://i.ytimg.com/vi/does-not-exist/hqdefault.jpg",
            }))
          : base;
      const items = all.slice(page * size, (page + 1) * size);
      return { items, page, size, hasNext: (page + 1) * size < all.length };
    },

    /**
     * 진행 중인 라이브 (SPEC_API §4.2 신설).
     *
     * 실제 판정은 백엔드가 YouTube Data API로 한다. mock은 **시계로 흉내낸다**
     * — 주일 청년예배 시간대(일요일 13:45~16:00 KST)면 방송 중으로 친다.
     * 그래야 "일요일에 저절로 뜬다"는 동작을 실제 시간에 맞춰 확인할 수 있다.
     *
     * 다른 요일에도 화면을 보려면 `?mock=live`(방송 중) ·
     * `?mock=no-live`(방송 없음)로 강제한다.
     */
    async live(): Promise<LiveStream | null> {
      await delay();
      throwIfScenario();

      if (scenario() === "no-live") return null;

      const now = new Date();
      // KST = UTC+9. 서버 시간대에 의존하지 않으려고 UTC로 계산한다
      const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const isSunday = kst.getUTCDay() === 0;
      const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
      const inWindow = minutes >= 13 * 60 + 45 && minutes < 16 * 60;

      if (scenario() !== "live" && !(isSunday && inWindow)) return null;

      // 방송 중일 때 보여줄 영상 — 가장 최근 예배 영상을 라이브인 것처럼 쓴다
      const [latest] = await sermonSource();
      return {
        videoId: latest.id,
        title: `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 주일 청년예배`,
        startedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        watchUrl: latest.youtubeUrl,
        thumbnailUrl: latest.thumbnailUrl,
      };
    },
  },
  bulletins: {
    async latest(): Promise<Bulletin | null> {
      await delay();
      throwIfScenario();
      /*
        열람은 회원(`M`)부터다 (BE 전달 2026-09-04 — 2026-08-25의 공개 열람
        전환 결정을 대체한다). mock이 가드를 갖지 않으면
        `NEXT_PUBLIC_USE_MOCK=1`로 개발하는 동안 게이트가 보이지 않아,
        실서버에 붙이고 나서야 빠진 것을 알게 된다 (MemberGate 주석).
      */
      requireSession();

      // 주보가 아직 없는 상태도 화면이 처리해야 한다 (SPEC_API §5.1: data null)
      if (scenario() === "empty") return null;
      const [newest] = allMockBulletins();
      return newest ? { id: newest.id, serviceDate: newest.serviceDate, pages: newest.pages } : null;
    },

    async list({ page = 0, size = 20 } = {}): Promise<Page<BulletinSummary>> {
      await delay();
      throwIfScenario();
      requireSession(); // 열람은 회원부터 — `latest()` 주석 참고

      const all: BulletinSummary[] =
        scenario() === "empty"
          ? []
          : allMockBulletins().map((b) => ({
              id: b.id,
              serviceDate: b.serviceDate,
              pageCount: b.pages.length,
              thumbUrl: b.thumbUrl,
            }));

      return { items: all.slice(page * size, (page + 1) * size), page, size, hasNext: false };
    },

    async get(id: string): Promise<Bulletin> {
      await delay();
      throwIfScenario();
      requireSession(); // 열람은 회원부터 — `latest()` 주석 참고

      const found = allMockBulletins().find((b) => b.id === id);
      if (!found) {
        throw new ApiError({ code: "NOT_FOUND", message: "주보를 찾을 수 없습니다.", status: 404 });
      }
      return { id: found.id, serviceDate: found.serviceDate, pages: found.pages };
    },

    async create(input: BulletinInput): Promise<{ id: string; pageCount: number }> {
      await delay();
      throwIfScenario();
      requireLeader("주보를 올릴 권한이 없습니다.");

      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.serviceDate)) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "주일 날짜를 선택해주세요.",
          status: 400,
          field: "serviceDate",
        });
      }
      if (input.pages.length === 0) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "주보 이미지를 1장 이상 선택해주세요.",
          status: 400,
          field: "pages",
        });
      }

      /*
        ★ 실패 케이스 — 같은 날짜가 이미 있으면 `DUPLICATE`다 (SPEC_API §5.4).
        화면이 "교체할까요?"를 물어본 뒤 삭제→재업로드로 처리하는 경로를
        여기서 실제로 밟을 수 있어야 한다.
      */
      if (allMockBulletins().some((b) => b.serviceDate === input.serviceDate)) {
        throw new ApiError({
          code: "DUPLICATE",
          message: "같은 날짜의 주보가 이미 있습니다.",
          status: 409,
        });
      }

      mockBulletinIdSeq += 1;
      const id = `${mockBulletinIdSeq}`;
      // 업로드한 blob을 그대로 붙잡아 뷰어에서 실제로 보이게 한다
      // (`uploads.put`의 objectURL과 같은 원리 — 새로고침하면 사라진다)
      const pages = input.pages.map((blob, index) => ({
        pageNo: index + 1,
        url: typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : "",
        width: 1448,
        height: 2048,
      }));

      dynamicBulletins.unshift({
        id,
        serviceDate: input.serviceDate,
        pages,
        // 실서비스는 서버가 썸네일을 만든다. mock은 1장을 그대로 쓴다
        thumbUrl: pages[0].url,
      });

      return { id, pageCount: pages.length };
    },

    async remove(id: string): Promise<void> {
      await delay();
      throwIfScenario();
      requireLeader("주보를 삭제할 권한이 없습니다.");

      const index = dynamicBulletins.findIndex((b) => b.id === id);
      if (index >= 0) {
        for (const page of dynamicBulletins[index].pages) {
          if (page.url.startsWith("blob:")) URL.revokeObjectURL(page.url);
        }
        dynamicBulletins.splice(index, 1);
        return;
      }

      if (!BULLETIN_DATES.some((b) => b.id === id)) {
        throw new ApiError({ code: "NOT_FOUND", message: "주보를 찾을 수 없습니다.", status: 404 });
      }
      // 고정 mock 주보는 파일이라 실제로 지울 수 없다 — 가려서 흉내낸다
      removedMockBulletinIds.add(id);
    },

    downloadUrl(id: string, pageNo: number): string {
      /*
       * 실제 서버는 302 → presigned(attachment)로 보낸다. mock은 이미지를
       * 그대로 가리켜서 브라우저가 저장할 수 있게 한다 — 파일명은 실서비스에서
       * 서버의 Content-Disposition이 정한다.
       */
      const found = allMockBulletins().find((b) => b.id === id);
      const page = found?.pages.find((p) => p.pageNo === pageNo);
      return (
        page?.url ??
        `/api/bulletins/${encodeURIComponent(id)}/pages/${encodeURIComponent(String(pageNo))}/download`
      );
    },
  },
  auth: {
    /**
     * SPEC_API §2.1 — 가입 1단계 명단 확인.
     * ⚠️ 불일치·명단 없음·이미 계정 있음·rate limit이 전부 같은 문구다 —
     *    어느 필드가 틀렸는지 알려주지 않는다 (명단 정보 탐색 방지).
     */
    async verifyRoster(input: VerifyRosterInput): Promise<VerifyRosterResult> {
      await delay();
      throwIfScenario();

      const name = input.name.trim();
      const matches = MOCK_ROSTER.filter(
        (r) =>
          r.name === name &&
          r.birthDate === input.birthDate &&
          digitsOnly(r.phone) === digitsOnly(input.phone),
      );

      if (matches.length >= 2) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "동명이인 확인이 필요합니다. 임원에게 문의해 주세요.",
          status: 400,
          field: null,
        });
      }

      const entry = matches[0];
      if (!entry || entry.claimedBy) {
        throw new ApiError({
          code: "UNAUTHORIZED",
          message: "명단에서 확인되지 않습니다.",
          status: 401,
        });
      }

      const registrationToken = `mock-reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      issuedRegistrationTokens.set(registrationToken, {
        entry,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return { registrationToken, name: entry.name, expiresIn: 300 };
    },

    /**
     * SPEC_API §2.2 — 가입 2단계, 즉시 MEMBER.
     * 세션은 만들지 않는다 — 201의 쿠키 발급 여부가 ❓ 미확정이라 FE는
     * "가입 완료 → 로그인 유도"로 가정한다.
     */
    async register(input: RegisterInput): Promise<RegisterResult> {
      await delay();
      throwIfScenario();

      const issued = issuedRegistrationTokens.get(input.registrationToken);
      if (!issued || issued.expiresAt < Date.now()) {
        issuedRegistrationTokens.delete(input.registrationToken);
        throw new ApiError({
          code: "UNAUTHORIZED",
          message: "확인이 만료되었습니다. 처음부터 다시 진행해주세요.",
          status: 401,
        });
      }
      if (findUserByLoginId(input.loginId)) {
        throw new ApiError({
          code: "DUPLICATE",
          message: "이미 사용 중인 아이디입니다.",
          status: 409,
          field: "loginId",
        });
      }
      const birthDigits = digitsOnly(issued.entry.birthDate);
      const phoneDigits = digitsOnly(issued.entry.phone);
      const pwDigits = digitsOnly(input.password);
      if (input.password.length < 8 || pwDigits === birthDigits || pwDigits === phoneDigits) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "비밀번호는 8자 이상이어야 하며 생년월일·전화번호와 같을 수 없습니다.",
          status: 400,
          field: "password",
        });
      }

      issuedRegistrationTokens.delete(input.registrationToken); // 1회용
      issued.entry.claimedBy = input.loginId;

      const user: AuthUser = {
        id: `${Date.now()}`,
        name: issued.entry.name,
        loginId: input.loginId,
        phone: issued.entry.phone,
        role: "MEMBER",
      };
      dynamicUsers[input.loginId] = user;
      passwords.set(input.loginId, input.password);
      return { id: user.id, name: user.name, role: user.role };
    },

    async login(input: LoginInput): Promise<LoginResult> {
      await delay();
      throwIfScenario();

      const user = findUserByLoginId(input.loginId);
      // 5회 실패 잠금(SPEC_API §2.3)도 이 문구와 동일한 응답이므로 mock은 구분하지 않는다
      if (!user || !user.loginId || input.password !== passwordOf(user.loginId)) {
        throw new ApiError({
          code: "UNAUTHORIZED",
          message: "아이디 또는 비밀번호가 올바르지 않습니다.",
          status: 401,
        });
      }

      // 실제로는 서버가 쿠키를 심는다 — mock은 로그인 시도 자체로 세션을 만든다.
      writeSession(user);
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

    /**
     * SPEC_API §2.9 — 전도사가 발급한 리셋 코드(§8.4)로 새 비밀번호 설정.
     * 실패(코드 불일치·만료)는 UNAUTHORIZED 단일 응답 — 필드 오류로 붙이지 않는다.
     */
    async resetPasswordWithCode(input: ResetPasswordWithCodeInput): Promise<void> {
      await delay();
      throwIfScenario();

      const issued = issuedResetCodes.get(input.loginId);
      const expired = !issued || issued.expiresAt < Date.now();
      if (expired || issued.resetCode !== input.resetCode.trim().toUpperCase()) {
        throw new ApiError({
          code: "UNAUTHORIZED",
          message: "코드가 올바르지 않거나 만료되었습니다.",
          status: 401,
        });
      }
      issuedResetCodes.delete(input.loginId); // 1회용
      passwords.set(input.loginId, input.password);
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
      const current = requireSession();
      if (!current.loginId || input.currentPassword !== passwordOf(current.loginId)) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "현재 비밀번호가 일치하지 않습니다.",
          status: 400,
          field: "currentPassword",
        });
      }
      passwords.set(current.loginId, input.newPassword);
    },

    async deleteAccount(input: { password?: string }): Promise<void> {
      await delay();
      throwIfScenario();
      const current = requireSession();
      // 카카오 가입자는 비밀번호가 없다 — 로그인 세션 자체가 본인 확인이다.
      if (current.loginId && input.password !== passwordOf(current.loginId)) {
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
