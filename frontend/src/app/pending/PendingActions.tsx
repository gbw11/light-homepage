"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/providers/AuthProvider";

/** WIREFRAME.md §10-3 — 로그아웃만 상호작용이 필요해 이 부분만 클라이언트 컴포넌트로 분리 */
export function PendingActions() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <Button variant="secondary" className="w-full" onClick={handleLogout}>
      로그아웃
    </Button>
  );
}
