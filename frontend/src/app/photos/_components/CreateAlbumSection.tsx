"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { CreateAlbumForm } from "./CreateAlbumForm";

/**
 * 앨범 생성 버튼을 임원(`LEADER`)·목회자(`PASTOR`)에게만 노출한다
 * (SPEC_API §6.2 권한 `L`).
 *
 * ⚠️ 화면에서 감추는 건 헛걸음을 줄이는 UI 편의일 뿐이다 — 실제 인가는
 * 서버가 한다 (WORKPLAN §5.1 "메뉴를 숨겼으니 됐다고 판단하지 않는다").
 */
export function CreateAlbumSection() {
  const { user } = useAuth();

  if (!user || (user.role !== "LEADER" && user.role !== "PASTOR")) return null;

  return <CreateAlbumForm />;
}
