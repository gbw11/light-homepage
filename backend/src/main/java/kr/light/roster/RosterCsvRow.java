package kr.light.roster;

import java.time.LocalDate;

/**
 * CSV 한 줄을 읽어 검증까지 마친 값.
 *
 * @param line             CSV 줄 번호(1-based). 리포트에서 "몇 번째 줄"을 가리킨다
 * @param name             동명이인 접미사 포함
 * @param phoneNormalized  숫자만 남긴 대조용 값
 * @param phoneDisplay     원문 그대로 — 전도사가 전화를 걸 때 쓴다 (§8.2)
 */
public record RosterCsvRow(
        int line,
        String name,
        LocalDate birthDate,
        String phoneNormalized,
        String phoneDisplay,
        String village
) {
    /** 같은 사람인지의 판단 기준 — DB의 member_roster_person_uk와 같은 세 값 */
    record PersonKey(String name, LocalDate birthDate, String phoneNormalized) {
    }

    PersonKey key() {
        return new PersonKey(name, birthDate, phoneNormalized);
    }
}
