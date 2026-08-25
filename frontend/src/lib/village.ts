import type { Village } from "@/types/api";

/**
 * 마을 코드 → 화면 표기 (`"3"` → `3마을`, `"newcomer"` → `새가족`).
 *
 * `/my`와 회원 관리에 같은 한 줄이 각자 복제돼 있었다. 화면이 하나 늘 때마다
 * 복제가 늘고, 어느 화면에서는 `새가족`이고 어느 화면에서는 `newcomer마을`이
 * 되는 식으로 갈라진다 — 같은 사람을 가리키는 표기가 화면마다 다르면 회원
 * 관리·열람 로그를 대조할 때 그대로 혼란이 된다. 세 번째 사용처가 생긴
 * 시점에 한 곳으로 모은다 (CONVENTIONS.md §2 "재사용 시점에 만든다").
 */
export function villageLabel(village: Village): string {
  return village === "newcomer" ? "새가족" : `${village}마을`;
}
