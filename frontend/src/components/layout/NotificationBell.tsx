"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { isLeaderOrAbove } from "@/components/auth/RequireLeader";

/** BE 권장 30초~1분 사이 — §14, 서버가 밀어주지 않는 폴링이다 */
const POLL_INTERVAL_MS = 45_000;

/** `2026-08-19T10:22:00Z` → `8/19 10:22` (현지 시각) */
function formatNotificationTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 헤더 알림 배지 + 목록 (§14 신설, FE-1 — BE PR `feat/be-newcomer-notification`
 * 구현에 대응하는 화면). 임원(`L`) 이상에게만 보인다.
 *
 * ⚠️ **배지는 `unreadCount`로 그린다.** `items`는 최근 20건으로 잘려서 오므로
 * 목록 길이로는 21건째부터 배지를 정확히 그릴 수 없다 (BE 주의 ①).
 *
 * ⚠️ 목록을 열면 그 응답의 `readMarker`를 **그대로** `until`에 넣어 읽음
 * 처리한다. 여기서 `new Date().toISOString()`처럼 클라이언트 시계를 쓰면,
 * 요청이 오가는 사이 서버에 새로 들어온 알림이 안 읽음으로 남는다 (BE 주의 ②).
 */
export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  const enabled = Boolean(user && isLeaderOrAbove(user.role));

  const { data } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: () => api.admin.notifications(),
    enabled,
    // 폴링이다 — 서버가 밀어주지 않는다 (§14 주의 ③)
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
  });

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setIsOpen(false);
      toggleRef.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  if (!enabled) return null;

  const unreadCount = data?.unreadCount ?? 0;

  function handleToggle() {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening && data && data.unreadCount > 0) {
      api.admin.markNotificationsRead({ until: data.readMarker }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
      });
    }
  }

  return (
    <div className="relative">
      <button
        ref={toggleRef}
        type="button"
        aria-label={unreadCount > 0 ? `알림 (안 읽음 ${unreadCount}건)` : "알림"}
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full text-xl transition hover:bg-white/10"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-red-500)] px-1 text-[10px] font-bold leading-none text-white"
          >
            {/* 배지도 unreadCount 그대로 — 20 초과는 "20+"로만 뭉뚱그린다 */}
            {unreadCount > 20 ? "20+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="새가족 알림"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-[var(--radius-card)] border border-white/15 bg-[var(--color-navy-900)] text-white shadow-lg"
        >
          <p className="border-b border-white/15 px-4 py-3 text-sm font-bold">새가족 알림</p>

          {!data || data.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-white/60">알림이 없습니다.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {data.items.map((item) => (
                <li
                  key={item.id}
                  className={`border-b border-white/15 px-4 py-3 text-sm last:border-b-0 ${
                    item.read ? "text-white/60" : "font-bold text-white"
                  }`}
                >
                  <p>{item.message}</p>
                  <p className="mt-1 text-xs text-white/50">
                    {formatNotificationTime(item.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/admin/newcomers"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-3 text-center text-sm font-bold text-[var(--color-accent-on-dark)] transition hover:bg-white/10"
          >
            새가족 명단 전체 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
