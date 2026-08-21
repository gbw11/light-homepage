"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query 클라이언트 프로바이더.
 *
 * 서버 상태(API 데이터)를 다루는 화면(예: `/news`)이 `useQuery`를 쓰기 위한
 * 최소 설정. 클라이언트당 하나의 QueryClient 인스턴스를 유지한다
 * (`useState`로 리렌더 시 재생성 방지).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
