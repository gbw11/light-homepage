import { z } from "zod";

/**
 * BCrypt가 다루는 비밀번호 상한은 **72바이트**다 — 글자 수가 아니다.
 *
 * `z.string().max(72)`로 쓰면 한글 비밀번호에서 어긋난다. UTF-8에서 한글은
 * 한 글자가 3바이트라 24자면 이미 72바이트고, 25자부터 서버가 거절한다.
 * 글자 수로 재면 FE 검증은 통과시키고 서버만 거절하는 상태가 되어,
 * 한국어 사용자만 이유 없이 막힌다 (BE가 2026-09-01 실서버 확인에서
 * 이 지점이 500으로 터지던 것을 잡았다 — 지금은 400으로 떨어진다).
 */
export const PASSWORD_MAX_BYTES = 72;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** 가입·재설정·변경이 같은 규칙을 쓰도록 한 곳에서 만든다 (SPEC_API §2.2). */
export function passwordField(label = "비밀번호") {
  return z
    .string()
    .min(8, `${label}는 8자 이상이어야 합니다.`)
    .refine((v) => byteLength(v) <= PASSWORD_MAX_BYTES, {
      message: `${label}가 너무 깁니다. 영문·숫자는 72자, 한글은 24자까지입니다.`,
    });
}
