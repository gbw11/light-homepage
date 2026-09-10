import type {
  AttendanceEntryInput,
  AttendanceSessionDetail,
  AttendanceSessionInput,
  AttendanceSessionSummary,
  AdminMember,
  AdminNotificationsResponse,
  AlbumInput,
  AlbumSummary,
  AttachmentUpload,
  AuthUser,
  Bulletin,
  BulletinInput,
  BulletinSummary,
  LiveStream,
  Sermon,
  PasswordResetCode,
  Cursor,
  MeetingCreateInput,
  MeetingDetail,
  MeetingSummary,
  MeetingView,
  MeetingWindowInput,
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
  RegisterInput,
  RegisterResult,
  ResetPasswordWithCodeInput,
  VerifyRosterInput,
  VerifyRosterResult,
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
    /**
     * SPEC_API §7.4 — 권한 `L` · `multipart/form-data`.
     *
     * ⚠️ **오래 걸리는 요청이다.** 서버가 PDF를 페이지 이미지로 동기 변환하며
     *    10페이지 기준 15~30초가 걸린다. 부르는 쪽은 그동안 진행 상태를
     *    보여줘야 한다 — 아무 표시가 없으면 사용자는 실패로 읽고 다시 누른다.
     */
    create(
      input: MeetingCreateInput,
      options?: {
        /**
         * PDF를 서버로 **보내는 동안**의 진행률(0~100).
         *
         * ⚠️ 이건 전송 구간이지 변환 구간이 아니다. 100%가 됐다는 건 파일이
         * 서버에 다 도착했다는 뜻일 뿐이고, 그때부터 15~30초의 변환이 시작된다.
         * 변환 진행은 서버가 알려주지 않으므로 화면이 지어내서는 안 된다.
         */
        onUploadProgress?: (percent: number) => void;
      },
    ): Promise<{ id: string; pageCount: number }>;
    /** SPEC_API §7.5 — 권한 `L`. 연장·조기 종료 둘 다 이 요청이다 */
    updateWindow(id: string, input: MeetingWindowInput): Promise<void>;
    /** SPEC_API §7.6 — 권한 `L` · 204. ⚠️ 페이지 이미지까지 지운다 */
    remove(id: string): Promise<void>;
    /**
     * SPEC_API §7.7 — 권한 `L`. 유출 시 워터마크 대조 근거.
     * 목록에 `totalViewers`(전체 열람자 수)가 함께 온다.
     */
    views(
      id: string,
      params?: { page?: number; size?: number },
    ): Promise<Page<MeetingView> & { totalViewers: number }>;
  };
  admin: {
    /** SPEC_API §8.1 — 권한 **`T`**. status 파라미터는 v1.3에서 폐기(PENDING 소멸) */
    members(params?: {
      q?: string;
      page?: number;
      size?: number;
    }): Promise<Page<AdminMember>>;
    /**
     * SPEC_API §8.2 — 권한 **`T`**. 계정 삭제 + 명단 재개방(선점 복구 절차).
     * 사유 필수 → 감사로그.
     */
    deleteMember(id: string, input: { reason: string }): Promise<void>;
    /**
     * SPEC_API §8.3 — 권한 **`T`**.
     * ⚠️ 마지막 `PASTOR`를 강등하면 회원 관리가 불가능해지므로
     *    서버가 `VALIDATION_ERROR`로 거부한다 (FR-ADM-05 자기 잠금 방지).
     */
    changeRole(id: string, input: { role: Role }): Promise<void>;
    /** SPEC_API §8.4 — 권한 **`T`**. 리셋 코드 발급(1회용·30분), 감사로그 */
    issuePasswordResetCode(id: string): Promise<PasswordResetCode>;
    /** SPEC_API §8.5 — 권한 `L`. 95% 도달 시 업로드 차단 */
    storage(): Promise<StorageUsage>;
    /** SPEC_API §8.6 — 권한 `L`. ⚠️ 개인정보, 보유기간 1년 */
    newcomers(params?: { page?: number; size?: number }): Promise<Page<NewcomerRecord>>;
    /**
     * ⚠️ **[CONTRACT] §14 신설** — 새가족 알림 (BE PR `feat/be-newcomer-notification`,
     * `DECISIONS.md` 2026-09-09). 권한 `L`(임원) 이상.
     *
     * 헤더 배지는 `unreadCount`로 그린다(`items`는 최근 20건으로 잘림 —
     * `AdminNotificationsResponse` 타입 주석 참고). 폴링이다(30초~1분 권장),
     * 서버가 밀어주지 않는다.
     */
    notifications(): Promise<AdminNotificationsResponse>;
    /**
     * 응답의 `readMarker`를 그대로 `until`에 넣어 호출한다 — 클라이언트가
     * 만든 타임스탬프를 넣지 않는다 (`AdminNotificationsResponse` 타입 주석).
     */
    markNotificationsRead(input: { until: string }): Promise<void>;
  };
  attendance: {
    /**
     * ⚠️ **[CONTRACT] 스펙에 없는 신규 영역이다** — 브리핑 §7 초안 기준.
     * 전부 권한 `L`(임원) 이상. `§9-E` 1차 범위 = 본인 조회 없음(`/attendance/me`
     * 미구현) + 임원은 전체 열람 — PM이 권장안을 채택했다 (DECISIONS 2026-08-28).
     */
    /** `GET /attendance/sessions` — 최신 날짜부터 */
    sessions(params?: { page?: number; size?: number }): Promise<Page<AttendanceSessionSummary>>;
    /** `POST /attendance/sessions` */
    createSession(input: AttendanceSessionInput): Promise<{ id: string }>;
    /** `GET /attendance/sessions/{id}` — 명단 전원 + 출결 상태 */
    session(id: string): Promise<AttendanceSessionDetail>;
    /**
     * `PUT /attendance/sessions/{id}/entries` — **upsert.** 손댄 항목만 보낸다.
     * 본문은 §7 예시 그대로 배열이다 (envelope 없음).
     */
    saveEntries(id: string, entries: AttendanceEntryInput[]): Promise<void>;
    /** `DELETE /attendance/sessions/{id}` — 204 */
    removeSession(id: string): Promise<void>;
  };
  sermons: {
    /**
     * ⚠️ **[CONTRACT] 스펙에 없는 신규 엔드포인트다** — 백엔드 합의 필요.
     *
     * 제안: `GET /api/sermons?page=&size=` · 권한 `G`(누구나) · 최신순.
     * 백엔드가 YouTube Data API를 프록시한다 (`Sermon` 타입 주석 — API 키를
     * 클라이언트에 실을 수 없다). 응답을 서버에서 캐시해두면 쿼터도 아낀다.
     */
    list(params?: { page?: number; size?: number }): Promise<Page<Sermon>>;
    /**
     * ⚠️ **[CONTRACT] 스펙에 없는 신규 엔드포인트다** — 백엔드 합의 필요.
     *
     * 제안: `GET /api/sermons/live` · 권한 `G`(누구나).
     * 진행 중인 라이브가 있으면 `LiveStream`, 없으면 **`null`**.
     *
     * 주일 청년예배가 일요일 13:45 무렵 올라온다. 화면은 60초마다 다시
     * 물어보므로(`LiveSection`) **캐시를 걸더라도 60초를 넘기지 않아야**
     * 방송 시작이 화면에 늦게 반영되지 않는다.
     */
    live(): Promise<LiveStream | null>;
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
  auth: {
    /**
     * SPEC_API §2.1 — 가입 1단계 명단 확인. 권한 `G`.
     * ⚠️ 실패(불일치·명단 없음·이미 계정·rate limit)는 전부 UNAUTHORIZED 단일 문구 —
     *    FE는 필드별 오류를 만들지 않는다. 동명이인 2건 이상만 VALIDATION_ERROR.
     */
    verifyRoster(input: VerifyRosterInput): Promise<VerifyRosterResult>;
    /** SPEC_API §2.2 — 가입 2단계, 즉시 MEMBER. 토큰 만료·재사용은 UNAUTHORIZED */
    register(input: RegisterInput): Promise<RegisterResult>;
    /** SPEC_API §2.3 — loginId 기반. 5회 실패 잠금도 일반 실패와 동일 응답 */
    login(input: LoginInput): Promise<LoginResult>;
    logout(): Promise<void>;
    refresh(): Promise<{ refreshed: boolean }>;
    me(): Promise<AuthUser>;
    /** SPEC_API §2.9 — 전도사가 발급한 리셋 코드로 재설정. 실패는 UNAUTHORIZED 단일 응답 */
    resetPasswordWithCode(input: ResetPasswordWithCodeInput): Promise<void>;
    updateProfile(input: { phone: string }): Promise<AuthUser>;
    changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
    /**
     * SPEC_API §2.13 — 탈퇴. `password`는 **비밀번호가 있는 계정에만** 보낸다.
     * 카카오 가입자(`loginId === null`)는 확인할 비밀번호가 없어, 필수로 두면
     * 영원히 탈퇴할 수 없다 — BE도 `@RequestBody(required = false)`다.
     */
    deleteAccount(input: { password?: string }): Promise<void>;
  };
};
