import type {
  AdminMember,
  AlbumInput,
  AlbumSummary,
  AttachmentUpload,
  AuthUser,
  Bulletin,
  BulletinInput,
  BulletinSummary,
  CompleteProfileInput,
  Cursor,
  MeetingDetail,
  MeetingSummary,
  NewcomerRecord,
  Photo,
  Role,
  StorageUsage,
  UploadCommitResult,
  UploadIssueInput,
  UploadTicket,
  LoginInput,
  LoginResult,
  NewcomerSubmission,
  Page,
  PostCategory,
  PostDetail,
  PostInput,
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
    /** SPEC_API §3.4 — 권한 `L`. `publish: false`면 임시저장 */
    create(input: PostInput): Promise<{ id: string }>;
    /** SPEC_API §3.5 — 권한 `L` · 요청 형태는 §3.4와 동일 */
    update(id: string, input: PostInput): Promise<void>;
    /** SPEC_API §3.5 — 권한 `L` · 204 (첨부 R2 객체까지 제거) */
    remove(id: string): Promise<void>;
  };
  attachments: {
    /**
     * SPEC_API §4.1 — 권한 `L` · `multipart/form-data` (필드명 `file`).
     *
     * ⚠️ `Content-Type`을 직접 지정하면 안 된다 — boundary는 브라우저가 붙인다.
     *    (`real.ts`의 `form` 옵션이 이걸 처리한다.)
     *
     * 게시물 저장 시 `attachmentIds`로 연결한다. 연결되지 않은 첨부는
     * 24시간 후 서버가 정리하므로, 저장에 실패해도 쓰레기가 남지는 않는다.
     */
    upload(file: File): Promise<AttachmentUpload>;
    /**
     * SPEC_API §4.2 — 다운로드.
     *
     * ⚠️ `photos.downloadUrl`과 같은 이유로 **fetch가 아니라 URL을 만든다.**
     *    서버가 302로 presigned URL(10분)로 보내므로 브라우저가 직접 이동해야
     *    한다. fetch로 받으면 리다이렉트를 따라가 파일을 메모리에 담게 된다.
     *    열람 권한은 게시물 권한을 상속하며, 로그아웃 상태면 `UNAUTHORIZED`다.
     */
    downloadUrl(attachmentId: string): string;
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
    /**
     * SPEC_API §6.3 — 권한 `L`.
     * ⚠️ **사진과 R2 객체를 모두 삭제한다.** 되돌릴 수 없다 (고아 객체 방지 목적).
     */
    remove(albumId: string): Promise<void>;
  };
  /**
   * 사진 업로드 (SPEC_API §6.5 · §6.6).
   *
   * ⚠️ **파일은 백엔드를 통과하지 않는다** — 브라우저가 R2로 직접 PUT한다
   * (ARCHITECTURE.md §7.3). 그래서 이 묶음은 세 갈래로 나뉜다:
   *   ① `issue`  서버에 photoId + presigned PUT URL을 받는다
   *   ② `put`    R2로 직접 전송한다 (우리 서버가 아니다)
   *   ③ `commit` 서버에 "올라갔다"고 알린다 → `COMMITTED` + 용량 기록
   *
   * ②를 화면 코드가 직접 `fetch`하지 않고 여기에 둔 이유: mock 모드에서
   * presigned URL이 실제로 존재하지 않기 때문이다. 여기 있으면 mock이
   * 전송·진행률·실패까지 흉내낼 수 있고, 화면 코드는 그대로 둔 채 real로
   * 바뀐다 (CONVENTIONS.md §3).
   */
  uploads: {
    /** SPEC_API §6.5 — 권한 `L`. 실패: `STORAGE_LIMIT`(용량 95% 초과) */
    issue(input: UploadIssueInput): Promise<{ uploads: UploadTicket[] }>;
    /**
     * presigned URL로 객체 하나를 PUT한다. **우리 서버가 아니라 R2로 간다.**
     *
     * 진행률이 필요하므로 구현은 `fetch`가 아니라 `XMLHttpRequest`다 —
     * `fetch`는 업로드 진행률을 알려주지 않는다.
     */
    put(
      url: string,
      body: Blob,
      options?: { onProgress?: (percent: number) => void; signal?: AbortSignal },
    ): Promise<void>;
    /** SPEC_API §6.6 — 권한 `L` · **20장 배치**로 부른다 (200회 호출은 낭비) */
    commit(photoIds: string[]): Promise<UploadCommitResult>;
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
    /** SPEC_API §6.9 — 권한 `L`. ⚠️ R2 객체까지 삭제한다. 되돌릴 수 없다 */
    remove(photoId: string): Promise<void>;
  };
  meetings: {
    /** SPEC_API §7.1 — 권한 `M`. 종료된 자료도 목록에는 남는다 */
    list(params?: { page?: number; size?: number }): Promise<Page<MeetingSummary>>;
    /** SPEC_API §7.2 — 권한 `M`. 기간 외면 `FORBIDDEN` + `viewReason` */
    get(id: string): Promise<MeetingDetail>;
    /**
     * SPEC_API §7.3 — 페이지 이미지 **URL을 만든다** (fetch가 아니다).
     *
     * ⚠️ 응답이 이미지 바이너리이고 **워터마크를 서버가 합성**한다.
     *    presigned URL이 아니라 이 엔드포인트를 `<img src>`로 직접 가리켜야 한다 —
     *    URL을 저장·공유할 수 없게 하는 것이 이 설계의 목적이다.
     *    `Cache-Control: no-store`이므로 캐시에도 남지 않는다.
     */
    pageUrl(id: string, pageNo: number): string;
  };
  admin: {
    /** SPEC_API §8.1 — 권한 **`T`** */
    members(params?: {
      status?: "PENDING" | "ALL";
      q?: string;
      page?: number;
      size?: number;
    }): Promise<Page<AdminMember>>;
    /** SPEC_API §8.2 — 권한 **`T`** */
    approveMember(id: string): Promise<void>;
    /** SPEC_API §8.3 — 권한 **`T`** */
    rejectMember(id: string, input: { reason: string }): Promise<void>;
    /**
     * SPEC_API §8.4 — 권한 **`T`**.
     * ⚠️ 마지막 `PASTOR`를 강등하면 아무도 회원을 승인할 수 없게 되므로
     *    서버가 `VALIDATION_ERROR`로 거부한다 (FR-ADM-05 자기 잠금 방지).
     */
    changeRole(id: string, input: { role: Role }): Promise<void>;
    /** SPEC_API §8.5 — 권한 `L`. 95% 도달 시 업로드 차단 */
    storage(): Promise<StorageUsage>;
    /** SPEC_API §8.6 — 권한 `L`. ⚠️ 개인정보, 보유기간 1년 */
    newcomers(params?: { page?: number; size?: number }): Promise<Page<NewcomerRecord>>;
  };
  bulletins: {
    /** SPEC_API §5.1 — 최신 주보. **없으면 null** */
    latest(): Promise<Bulletin | null>;
    /** SPEC_API §5.2 — 지난 주보 목록 */
    list(params?: { page?: number; size?: number }): Promise<Page<BulletinSummary>>;
    /** SPEC_API §5.3 — 단건 조회 (§5.1과 동일 형태) */
    get(id: string): Promise<Bulletin>;
    /**
     * ⚠️ **[CONTRACT] 스펙에 없는 신규 엔드포인트다** — 백엔드 합의 필요.
     *
     * `FR-BUL-04`는 "장별 개별 다운로드"를 요구하지만 `SPEC_API §5`에 다운로드
     * 엔드포인트가 없다. `§5.1`의 `pages[].url`은 **열람용**이라
     * `Content-Disposition: attachment`가 없어서, 그걸로 받으면 브라우저가
     * 탭에서 열어버린다.
     *
     * 그래서 사진(`§6.7`)·첨부(`§4.2`)와 같은 형태를 제안한다:
     *   `GET /api/bulletins/{id}/pages/{pageNo}/download`
     *   권한 `M` · **302** → presigned URL (`Content-Disposition: attachment`)
     *
     * 합의 전까지 FE는 이 경로를 가리키기만 하므로, 백엔드가 다른 경로를
     * 택하면 이 함수 한 곳만 바꾸면 된다.
     */
    /**
     * SPEC_API §5.4 — 권한 `L` · `multipart/form-data`.
     *
     * ⚠️ **사진첩과 전송 경로가 다르다.** 주보는 presigned PUT이 아니라
     * **Spring을 통과**한다 (페이지가 2~4장이라 서버를 거치는 비용이 문제가
     * 아니고, 순서를 한 요청 안에서 확정하는 편이 안전하다).
     *
     * 실패: 같은 날짜가 이미 있으면 `DUPLICATE` — **교체 여부를 화면이 물어본
     * 뒤 다시 요청한다** (§5.4). 용량 초과는 `STORAGE_LIMIT`.
     */
    create(input: BulletinInput): Promise<{ id: string; pageCount: number }>;
    /** SPEC_API §5.5 — 권한 `L` · `204`. ⚠️ R2 객체까지 삭제한다 */
    remove(id: string): Promise<void>;
    downloadUrl(id: string, pageNo: number): string;
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
