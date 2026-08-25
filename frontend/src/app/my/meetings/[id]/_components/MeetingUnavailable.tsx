import Link from "next/link";
import type { MeetingStatus } from "@/types/api";
import { formatDeadline } from "../../_components/meetingFormat";

type MeetingUnavailableProps = {
  title?: string;
  /** 모르는 경우(FORBIDDEN을 그냥 받은 경우)도 있다 */
  status?: MeetingStatus;
  /** `§7.2`의 `viewableUntil` — 있으면 "언제까지였는지"를 알려준다 */
  viewableUntil?: string;
  /** 서버가 준 문장이 있으면 그대로 보여준다 (§7.2 `FORBIDDEN`) */
  serverMessage?: string;
};

/**
 * WIREFRAME.md §14b-3 — 열람할 수 없는 자료를 열었을 때.
 *
 * ⚠️ **이 화면은 서버 판정의 결과를 보여주는 것이다.** 프론트가 날짜를
 * 계산해서 띄우는 게 아니다 (SPEC_FUNCTIONAL §6.2 FR-MTG-02/05). 진입 경로는
 * 두 가지뿐이고 둘 다 서버가 정한다:
 *   · `GET /api/meetings/{id}`가 `canView: false`로 응답 (§7.2)
 *   · 같은 요청이 `FORBIDDEN`으로 실패 (§7.2 실패 표)
 *
 * `SCHEDULED`와 `CLOSED`는 사용자에게 완전히 다른 사실이다("아직"과 "이제
 * 끝났다") — `viewReason`이 둘 다 `PERIOD_CLOSED`로 오므로 `status`로 문장을
 * 가른다.
 */
export function MeetingUnavailable({
  title,
  status,
  viewableUntil,
  serverMessage,
}: MeetingUnavailableProps) {
  const scheduled = status === "SCHEDULED";

  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <p className="text-4xl" aria-hidden>
        {scheduled ? "🕓" : "⏰"}
      </p>

      {/*
        이 화면이 이 페이지의 전부이므로 `h1`이다 — 페이지마다 h1이 정확히
        하나 있어야 한다 (SPEC_NONFUNCTIONAL.md §6, `Section`의 `titleAs`와
        같은 이유). 뷰어 쪽 `h1`은 자료 제목이다.
      */}
      <h1 className="mt-6 text-xl font-bold md:text-2xl">
        {scheduled ? "아직 열람 기간이 아닙니다" : "열람 기간이 종료되었습니다"}
      </h1>

      {title && <p className="mt-2 font-bold">{title}</p>}

      {!scheduled && viewableUntil && (
        <p className="mt-4 text-sm text-[var(--color-gray-400)]">
          {formatDeadline(viewableUntil)}까지 열람할 수 있었습니다.
        </p>
      )}

      {scheduled && (
        <p className="mt-4 text-sm text-[var(--color-gray-400)]">
          열람이 시작되면 목록에서 &ldquo;열람 가능&rdquo;으로 바뀝니다.
        </p>
      )}

      {serverMessage && (
        <p className="mt-4 text-sm text-[var(--color-gray-400)]">{serverMessage}</p>
      )}

      <p className="mt-4 text-sm text-[var(--color-gray-400)]">
        자료가 필요하시면 임원에게 문의해 주세요.
      </p>

      <div className="mt-8">
        <Link
          href="/my/meetings"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold text-[var(--color-ink)] transition hover:brightness-95"
        >
          목록으로
        </Link>
      </div>
    </div>
  );
}
