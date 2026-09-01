package kr.light.roster;

/**
 * 임포트 중 발견한 문제 한 건.
 *
 * <p>⚠️ {@code detail}에 전화번호 원문을 넣지 않는다 — 리포트는 로그로 남고
 * 스크린샷으로 이슈에 붙는다. {@link kr.light.common.PhoneNumbers#mask}를 쓴다.
 *
 * @param line CSV 줄 번호(1-based, 헤더 포함). 0이면 파일 전체에 대한 문제
 */
public record RosterProblem(int line, Kind kind, String detail) {

    public enum Kind {
        /** 필수 열을 헤더에서 찾지 못했다 */
        MISSING_HEADER("헤더 누락"),
        /** 필수 값이 비어 있다 */
        MISSING_FIELD("빈 값"),
        /** 생년월일을 날짜로 읽지 못했다 */
        BAD_BIRTH_DATE("생년월일 형식"),
        /** 전화번호 자릿수가 말이 안 된다 */
        BAD_PHONE("전화번호 형식"),
        /** CSV 안에서 같은 사람이 두 번 나온다 */
        DUPLICATE_IN_CSV("CSV 내 중복"),
        /** ★ 동명이인인데 접미사가 빠진 것으로 보인다 */
        SUFFIX_SUSPECT("동명이인 접미사 누락 의심"),
        /** DB에는 있는데 이번 CSV에 없다 */
        MISSING_FROM_CSV("CSV에 없음");

        private final String label;

        Kind(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    /** 사람이 고칠 수 있어야 의미가 있는 문제인가 — 가입을 실제로 막는 것들 */
    public boolean blocksSignup() {
        return kind == Kind.SUFFIX_SUSPECT || kind == Kind.DUPLICATE_IN_CSV;
    }
}
