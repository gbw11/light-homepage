import type {
  AuthUser,
  CompleteProfileInput,
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
