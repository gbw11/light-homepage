/**
 * 업로드 큐의 한 항목. **파일 하나 = 항목 하나**이고, 화면의 목록·카운트·재시도가
 * 모두 이 상태를 읽는다 (WIREFRAME §18).
 *
 * - `PREPARING` 브라우저 리사이즈 중 (1280/640 생성)
 * - `SKIPPED`   리사이즈 불가 — HEIC 등. **재시도해도 결과가 같아서 실패와 구분한다**
 * - `READY`     리사이즈 완료, 전송 대기
 * - `UPLOADING` R2로 PUT 중 (`progress`)
 * - `DONE`      commit까지 끝남
 * - `FAILED`    전송·commit 실패 — **재시도 대상**
 */
export type QueueItemStatus =
  | "PREPARING"
  | "SKIPPED"
  | "READY"
  | "UPLOADING"
  | "DONE"
  | "FAILED";

export type QueueItem = {
  /** `uploads:issue` 요청의 `clientId` (SPEC_API §6.5) */
  clientId: string;
  fileName: string;
  status: QueueItemStatus;
  /** 0~100. `UPLOADING`에서만 의미가 있다 */
  progress: number;
  error?: string;
  /**
   * `uploads:issue`가 발급한 photoId.
   *
   * ⚠️ 재시도는 **같은 photoId로 URL을 재발급**해야 한다 — 새로 발급하면 이미
   * 올라간 객체가 주인 없이 남는다 (SPEC_API §6.5 "고아 방지").
   */
  photoId?: string;
};

/** `f1`, `f2`, … — 한 세션 안에서만 유일하면 된다 (서버는 photoId로 식별한다) */
let clientIdSeq = 0;
export function nextClientId(): string {
  clientIdSeq += 1;
  return `f${clientIdSeq}`;
}

/** 리사이즈·전송 동시 실행 수 (FR-PHO-08 "동시 3~4개씩") */
export const CONCURRENCY = 4;

/**
 * 한 번에 URL을 발급받는 장수.
 *
 * presigned URL은 **15분**만 유효하다 (SPEC_API §6.5). 200장을 한 번에 발급하면
 * 뒤쪽 URL이 쓰기 전에 만료된다 — 그래서 배치로 나눠 발급하고, 배치가 끝나면
 * 다음 배치를 발급한다. commit도 같은 단위(20장)로 부른다 (§6.6).
 */
export const BATCH_SIZE = 20;

/**
 * 최대 `limit`개만 동시에 돌린다.
 *
 * ⚠️ **전부 병렬로 던지면 안 된다** (FR-PHO-08 "동시 3~4개씩 큐 처리").
 * 243장을 한꺼번에 fetch하면 브라우저 연결 수 제한에 걸려 앞쪽 요청까지
 * 느려지고, presigned URL 15분 유효시간 안에 못 끝날 수 있다.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await task(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
}

/** 배열을 크기 `size`씩 자른다 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
