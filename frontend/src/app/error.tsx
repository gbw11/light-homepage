"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";

/**
 * 공통 에러 화면 — 화면을 그리다 예외가 났을 때 (점검 🟠-15 · FR-PUB-10).
 *
 * 없으면 Next의 영어 기본 화면이 뜬다. 공개 영역에서 가장 흔한 원인은
 * **백엔드가 꺼져 있는 것**이다 — 서버는 06~24시에만 돈다(2026-08-27). 그래서
 * "고장"이 아니라 "잠시 후 다시"로 안내하고, 다시 시도 버튼을 준다.
 *
 * ⚠️ 운영 빌드에서는 서버 컴포넌트가 던진 에러의 `message`가 가려진다(digest만
 * 온다). 그래서 원인별로 문구를 나누지 않고 한 가지 안내로 쓴다.
 *
 * `retry()`는 서버에서 다시 받아와 다시 그린다 (Next 16 — `reset()`은 다시 받지
 * 않고 그리기만 해서, 서버가 돌아왔어도 같은 에러가 난다).
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" tabIndex={-1}>
      <Section className="text-center">
        <div className="mx-auto max-w-sm space-y-6">
          <h1 className="text-xl font-bold">잠시 화면을 불러오지 못했습니다</h1>
          <p className="leading-relaxed text-[var(--color-gray-400)]">
            서버에 잠시 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => retry()}>다시 시도</Button>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold text-[var(--color-ink)] transition hover:brightness-95"
            >
              홈으로
            </Link>
          </div>
        </div>
      </Section>
    </main>
  );
}
