import { afterEach, describe, expect, it, vi } from "vitest";
import { realApi } from "./real";

/**
 * LIGHT-52: 401 → refresh → 재시도.
 *
 * `src/lib/api/real.ts`의 `request()`는 401(UNAUTHORIZED)을 만나면
 * `POST /auth/refresh`를 단 한 번만 시도하고(single-flight), 성공하면
 * 원래 요청을 정확히 1회 재시도한다. 여러 요청이 동시에 401을 맞아도
 * 리프레시는 하나의 프로미스를 공유해야 한다 — 리프레시 토큰이
 * 사용 시 회전하기 때문에, 두 번째·세 번째가 각자 리프레시를 보내면
 * 이미 폐기된 토큰을 쓰게 되어 멀쩡한 세션이 끊긴다.
 *
 * `real.ts`를 index를 거치지 않고 직접 import한다 — `NEXT_PUBLIC_USE_MOCK`
 * 값과 무관하게 실제 구현을 검증하기 위해서다.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function unauthorizedResponse(): Response {
  return jsonResponse(401, {
    error: { code: "UNAUTHORIZED", message: "토큰이 만료되었습니다.", field: null },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("real.ts — 401 → refresh → 재시도", () => {
  it("동시에 3개 요청이 401을 받으면 /auth/refresh는 정확히 1회만 호출되고, 3개 모두 재시도 후 성공한다", async () => {
    let refreshCallCount = 0;
    // /api/posts/1에 대한 호출별로 "이번이 몇 번째 시도인지" 추적해서
    // 각 논리적 요청이 첫 시도엔 401, 재시도엔 200을 받도록 구성한다
    let postsCallCount = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/auth/refresh")) {
        refreshCallCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return jsonResponse(200, { data: { refreshed: true } });
      }

      if (url.includes("/api/posts/1")) {
        postsCallCount += 1;
        // 앞의 3개 호출(최초 시도) → 401, 이후 호출(재시도) → 200
        if (postsCallCount <= 3) {
          return unauthorizedResponse();
        }
        return jsonResponse(200, { data: { id: "1", title: "공지" } });
      }

      throw new Error(`예상치 못한 요청: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.all([
      realApi.posts.get("1"),
      realApi.posts.get("1"),
      realApi.posts.get("1"),
    ]);

    expect(refreshCallCount).toBe(1);
    expect(results).toEqual([
      { id: "1", title: "공지" },
      { id: "1", title: "공지" },
      { id: "1", title: "공지" },
    ]);

    const refreshCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/api/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);

    // 최초 시도 3회 + 재시도 3회 = /api/posts/1로 총 6번
    const postCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/api/posts/1"),
    );
    expect(postCalls).toHaveLength(6);
  });

  it("리프레시 대상이 아닌 경로(NO_REFRESH_PATHS)는 401을 받아도 refresh를 호출하지 않고 그대로 던진다", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/login")) {
        return jsonResponse(401, {
          error: { code: "UNAUTHORIZED", message: "비밀번호가 틀립니다.", field: null },
        });
      }
      throw new Error(`예상치 못한 요청: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      realApi.auth.login({ loginId: "member", password: "wrong" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const refreshCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/api/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
