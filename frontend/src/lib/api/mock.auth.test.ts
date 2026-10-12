import { describe, expect, it } from "vitest";
import { mockApi } from "./mock";
import { isApiError } from "./error";

/**
 * mock이 실서버 계약과 같게 실패하는지 (SPEC_API §12.1 — "mock은 실패 케이스까지
 * 실제 계약을 따른다"). USERFLOW_AUDIT 2026-10-07 §5 표의 어긋남을 고친 부분.
 */

async function failureOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (error) {
    if (isApiError(error)) return { code: error.code, field: error.field };
    throw error;
  }
  throw new Error("실패해야 하는데 성공했다");
}

describe("mock verifyRoster — 형식 검증 (🟡-5)", () => {
  it("달력에 없는 생년월일은 VALIDATION_ERROR field birthDate", async () => {
    expect(
      await failureOf(mockApi.auth.verifyRoster({ name: "김도연b", birthDate: "1999-02-30", phone: "010-3333-4444" })),
    ).toEqual({ code: "VALIDATION_ERROR", field: "birthDate" });
  });

  it("자릿수가 안 맞는 전화번호는 VALIDATION_ERROR field phone", async () => {
    expect(
      await failureOf(mockApi.auth.verifyRoster({ name: "김도연b", birthDate: "1999-07-01", phone: "010-12" })),
    ).toEqual({ code: "VALIDATION_ERROR", field: "phone" });
  });

  it("형식이 맞고 명단에 없으면 UNAUTHORIZED (필드 없음)", async () => {
    expect(
      await failureOf(mockApi.auth.verifyRoster({ name: "없는사람", birthDate: "1999-07-01", phone: "010-3333-4444" })),
    ).toEqual({ code: "UNAUTHORIZED", field: null });
  });

  it("전화번호 표기는 자유 — 하이픈 없이도 통과한다", async () => {
    const result = await mockApi.auth.verifyRoster({ name: "김도연b", birthDate: "1999-07-01", phone: "01033334444" });
    expect(result.name).toBe("김도연b");
  });
});
