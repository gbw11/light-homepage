/**
 * `/`와 `/home`의 LIGHT 워드마크를 잇는 view transition 이름.
 * **양쪽이 같은 문자열을 써야만** 브라우저가 둘을 같은 것으로 보고 움직임을
 * 만든다. 오타 하나로 조용히 아무 일도 안 일어나므로 상수로 둔다.
 *
 * 별도 모듈인 이유: 이 상수가 `LandingGate.tsx` 안에 있으면 `/home`(서버
 * 컴포넌트)이 상수 하나를 가져오려고 그 파일 전체를 자기 번들에 끌고 온다.
 */
export const LIGHT_WORDMARK = "light-wordmark";
