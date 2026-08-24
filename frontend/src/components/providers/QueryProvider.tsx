"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isApiError } from "@/lib/api";

/**
 * TanStack Query 클라이언트 프로바이더.
 *
 * 서버 상태(API 데이터)를 다루는 화면(예: `/news`)이 `useQuery`를 쓰기 위한
 * 최소 설정. 클라이언트당 하나의 QueryClient 인스턴스를 유지한다
 * (`useState`로 리렌더 시 재생성 방지).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * 기본값(3회 재시도)은 4xx에도 재시도한다 — 401·403·404는 다시
             * 물어봐도 답이 바뀌지 않으므로 화면이 3배 느리게 실패하고
             * 서버에 무의미한 부하만 준다. 재시도는 5xx·네트워크 오류에만
             * 의미가 있다.
             */
            retry: (failureCount, error) => {
              const status = isApiError(error) ? error.status : 0;
              if (status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
