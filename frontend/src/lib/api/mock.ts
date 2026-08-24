import type {
  AuthUser,
  CompleteProfileInput,
  LoginInput,
  LoginResult,
  NewcomerSubmission,
  Page,
  PostDetail,
  PostSummary,
  SignupInput,
} from "@/types/api";
import { ApiError } from "./error";
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
  "16": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "지난주 여름 성경학교가 은혜롭게 마무리되었습니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "함께해주신 모든 분들께 감사드립니다." }],
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
};

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

export const mockApi: Api = {
  posts: {
    async list({ category, page = 0, size = 20 }): Promise<Page<PostSummary>> {
      await delay();
      throwIfScenario();

      // 빈 목록도 반드시 확인해야 하는 상태다
      const items = scenario() === "empty" ? [] : NOTICES.filter((p) => p.category === category);

      return { items, page, size, hasNext: false };
    },

    async get(idOrSlug: string): Promise<PostDetail> {
      await delay();
      throwIfScenario();

      const summary = NOTICES.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
      const detail = summary ? NOTICE_DETAILS[summary.id] : undefined;

      if (!summary || !detail) {
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
