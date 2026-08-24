import type {
  AlbumInput,
  AlbumSummary,
  AuthUser,
  Bulletin,
  BulletinSummary,
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
    /**
     * SPEC_API §6.8 — 선택한 사진을 ZIP으로. **최대 30장.**
     *
     * `photos.downloadUrl`과 같은 이유로 URL만 만든다 (ZIP 스트리밍 응답).
     * 30장 제한은 서버가 `VALIDATION_ERROR`(field `ids`)로 막지만, 화면이
     * 먼저 막아야 헛된 요청이 안 나간다.
     */
    downloadUrl(albumId: string, photoIds: string[]): string;
  };
  photos: {
    /** SPEC_API §6.10 — 초상권 대응 신고·삭제 요청. 권한 `M` */
    report(photoId: string, input: { reason: string }): Promise<void>;
    /**
     * SPEC_API §6.7 — 개별 다운로드.
     *
     * ⚠️ **fetch가 아니라 URL을 만든다.** 서버가 302로 presigned URL
     *    (`Content-Disposition: attachment`)로 보내므로 브라우저가 직접
     *    이동해야 한다. fetch로 받으면 리다이렉트를 따라가 메모리에 담게 된다.
     */
    downloadUrl(photoId: string): string;
  };
  bulletins: {
    /** SPEC_API §5.1 — 최신 주보. **없으면 null** */
    latest(): Promise<Bulletin | null>;
    /** SPEC_API §5.2 — 지난 주보 목록 */
    list(params?: { page?: number; size?: number }): Promise<Page<BulletinSummary>>;
    /** SPEC_API §5.3 — 단건 조회 (§5.1과 동일 형태) */
    get(id: string): Promise<Bulletin>;
  };
  /**
   * mock이 흉내낼 수 없는 기능을 화면이 알 수 있게 한다.
   *
   * 예: ZIP 스트리밍(§6.8)은 서버가 만들어야 하므로 mock에서는 파일이 나오지
   * 않는다. 이 플래그가 없으면 화면이 "다운로드했습니다"라고 거짓 성공을
   * 표시하게 된다 — mock은 가짜여도 되지만 **성공했다고 속이면 안 된다.**
   */
  capabilities: {
    /** `false`면 ZIP 다운로드가 실제로 파일을 만들지 않는다 (mock) */
    zipDownload: boolean;
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
