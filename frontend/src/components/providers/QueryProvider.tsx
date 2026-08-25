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
             * 기본 staleTime 0이면 두 가지 낭비가 생긴다:
             * ① 서버에서 프리페치해 hydrate한 데이터(`/news`)가 도착 즉시
             *   stale로 취급돼 마운트하자마자 같은 요청을 한 번 더 보낸다 —
             *   프리페치가 무의미해진다.
             * ② 창 포커스가 돌아올 때마다 재요청한다. 무한스크롤 화면
             *   (사진첩·월례회 목록)은 로드된 **모든 페이지**를 순차
             *   재요청하므로 alt-tab 한 번에 요청 폭주가 난다.
             * 신선도가 진짜 중요한 화면(월례회 열람 창 등)은 이미 각자
             * `staleTime: 0`을 명시하고 있어 그대로 동작한다.
             */
            staleTime: 60_000,
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
