import type {
  AlbumInput,
  AlbumSummary,
  AuthUser,
  CompleteProfileInput,
  Cursor,
  Photo,
  LoginInput,
  LoginResult,
  NewcomerSubmission,
  Page,
  PostCategory,
  PostDetail,
  PostSummary,
  SignupInput,
} from "@/types/api";

/**
 * mock과 real이 동시에 만족해야 하는 인터페이스.
 *
 * 새 엔드포인트를 붙일 때는 **여기에 먼저 선언**한다.
 * 그러면 mock.ts / real.ts 양쪽 구현을 빠뜨릴 수 없다 (타입 오류로 잡힌다).
 */
export type Api = {
  posts: {
    list(params: {
      category: PostCategory;
      page?: number;
      size?: number;
    }): Promise<Page<PostSummary>>;
    get(idOrSlug: string): Promise<PostDetail>;
  };
  newcomers: {
    submit(input: NewcomerSubmission): Promise<{ id: string }>;
  };
  albums: {
    /** SPEC_API §6.1 — 권한 `M` */
    list(params?: { page?: number; size?: number }): Promise<Page<AlbumSummary>>;
    /** SPEC_API §6.2 — 권한 `L` */
    create(input: AlbumInput): Promise<{ id: string }>;
    /** SPEC_API §6.4 — 권한 `M` · **커서** 페이징 (수백 장 스크롤) */
    photos(
      albumId: string,
      params?: { cursor?: string; size?: number },
    ): Promise<Cursor<Photo>>;
  };
  photos: {
    /** SPEC_API §6.10 — 초상권 대응 신고·삭제 요청. 권한 `M` */
    report(photoId: string, input: { reason: string }): Promise<void>;
  };
  auth: {
    signup(input: SignupInput): Promise<{ id: string; role: AuthUser["role"] }>;
    login(input: LoginInput): Promise<LoginResult>;
    logout(): Promise<void>;
    refresh(): Promise<{ refreshed: boolean }>;
    me(): Promise<AuthUser>;
    completeProfile(
      input: CompleteProfileInput,
    ): Promise<{ profileComplete: boolean; role: AuthUser["role"] }>;
    passwordResetRequest(input: { email: string }): Promise<void>;
    passwordResetConfirm(input: { token: string; password: string }): Promise<void>;
    updateProfile(input: { phone: string }): Promise<AuthUser>;
    changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
    deleteAccount(input: { password: string }): Promise<void>;
  };
};
