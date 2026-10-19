import { describe, expect, it } from "vitest";
import { birthDateProblem, formatBirthDateInput } from "./birthDate";

describe("birthDateProblem — 서버 §9.1과 같은 기준", () => {
  const now = new Date("2026-10-19T03:00:00Z");

  it.each([
    ["", "생년월일을 입력해주세요."],
    ["20010314", "생년월일을 YYYY-MM-DD 형식으로 입력해주세요."],
    ["2001-02-30", "생년월일을 확인해주세요."], // 달력에 없는 날짜
    ["1899-12-31", "생년월일을 확인해주세요."], // 1900년 이전
    ["2026-10-20", "생년월일을 확인해주세요."], // 미래
  ])("%s → %s", (input, message) => {
    expect(birthDateProblem(input, now)).toBe(message);
  });

  it("올바른 날짜와 오늘은 통과한다", () => {
    expect(birthDateProblem("2001-03-14", now)).toBeNull();
    expect(birthDateProblem("2026-10-19", now)).toBeNull();
  });
});

describe("formatBirthDateInput — 숫자만 눌러도 대시가 붙는다", () => {
  it.each([
    ["2001", "2001"],
    ["200103", "2001-03"],
    ["20010314", "2001-03-14"],
    ["2001-03-149", "2001-03-14"],
    ["2001.03.14", "2001-03-14"],
  ])("%s → %s", (input, expected) => {
    expect(formatBirthDateInput(input)).toBe(expected);
  });
});
