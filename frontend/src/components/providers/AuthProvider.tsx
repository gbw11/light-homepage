"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError, onSessionExpired } from "@/lib/api";
import type { AuthUser } from "@/types/api";

const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

type AuthContextValue = {
  /** 로그인 안 됨 = null. 로딩 중에는 isLoading을 함께 본다 */
  user: AuthUser | null;
  isLoading: boolean;
  /** 로그인 성공 직후처럼 세션이 바뀐 걸 알 때 호출 */
  refetch: () => void;
  logout: () => Promise<void>;
  /**
   * 세션이 끝났을 때(로그아웃·탈퇴) 회원 데이터를 캐시에서 전부 지운다.
   * 서버 호출은 하지 않는다 — 탈퇴처럼 서버 쪽 처리가 이미 끝난 뒤에 부른다.
   */
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 로그인 상태를 앱 전역에서 공유한다. `GET /api/auth/me`(SPEC_API §2.5)를
 * 세션 소스로 삼는다 — 로그인 자체는 이 화면에서 안 하고, 로그인/가입 폼이
 * 성공한 뒤 `refetch()`로 이 상태를 갱신한다.
 *
 * `UNAUTHORIZED`는 "로그인 안 함"으로 취급해 에러로 던지지 않는다. 그 외
 * 에러(네트워크 오류 등)는 그대로 던져 react-query가 재시도/에러로 다룬다.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        return await api.auth.me();
      } catch (error) {
        if (isApiError(error) && error.code === "UNAUTHORIZED") return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });

  /**
   * API 계층이 "리프레시까지 실패했다"고 알리면 세션 상태를 비운다.
   * 그러면 `RequireMember`가 이미 갖고 있는 로직이 `/login`으로 보낸다
   * (SPEC_API §12.2의 "실패 → 로그인 화면으로 이동").
   */
  useEffect(() => onSessionExpired(() => {
    queryClient.setQueryData(AUTH_ME_QUERY_KEY, null);
  }), [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    /**
     * 🟠-4 (USERFLOW_AUDIT 2026-10-07) — 로그아웃·탈퇴 뒤에 회원 공지 제목 같은
     * 회원 데이터가 캐시에 남아 같은 탭에서 그대로 보이면 안 된다 (FR-MEM-02/03).
     *
     * `queryClient.clear()`를 그대로 쓰지 않는 이유: 이 Provider가 구독 중인
     * `auth/me` 쿼리까지 지워지면, 뒤이어 `setQueryData`로 만든 새 쿼리를
     * 기존 옵저버가 구독하지 않아 헤더·게이트가 "로그인됨"으로 남을 수 있다.
     * 그래서 `auth/me`만 남기고 나머지 쿼리를 전부 지운 뒤
     * `auth/me`를 null로 바꾼다 — 효과는 clear()와 같다.
     */
    const clearSession = () => {
      queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey[0] !== AUTH_ME_QUERY_KEY[0] || query.queryKey[1] !== AUTH_ME_QUERY_KEY[1],
      });
      queryClient.setQueryData(AUTH_ME_QUERY_KEY, null);
    };

    return {
      user: data ?? null,
      isLoading,
      refetch: () => {
        void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      },
      logout: async () => {
        await api.auth.logout();
        clearSession();
      },
      clearSession,
    };
  }, [data, isLoading, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}
