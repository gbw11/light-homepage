"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError, onSessionExpired } from "@/lib/api";
import type { AuthUser } from "@/types/api";

export const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

type AuthContextValue = {
  /** 로그인 안 됨 = null. 로딩 중에는 isLoading을 함께 본다 */
  user: AuthUser | null;
  isLoading: boolean;
  /** 로그인 성공 직후처럼 세션이 바뀐 걸 알 때 호출 */
  refetch: () => void;
  logout: () => Promise<void>;
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data ?? null,
      isLoading,
      refetch: () => {
        void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      },
      logout: async () => {
        await api.auth.logout();
        queryClient.setQueryData(AUTH_ME_QUERY_KEY, null);
      },
    }),
    [data, isLoading, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}
