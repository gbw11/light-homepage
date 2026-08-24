/**
 * 세션이 끊겼다는 사실을 API 계층 → UI 계층으로 알리는 통로.
 *
 * API 계층에서 `window.location`으로 직접 리다이렉트하지 않는 이유:
 *   · 서버 컴포넌트/테스트 환경에서 터진다
 *   · "어디로 보낼지"는 화면의 관심사다 (API 계층이 라우팅을 알 필요 없다)
 *
 * 대신 여기서 알리기만 하고, `AuthProvider`가 구독해서 세션 상태를 비운다.
 * 그러면 `RequireMember`가 이미 갖고 있는 리다이렉트 로직이 자연스럽게 동작한다.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** 리프레시까지 실패해서 더는 로그인 상태를 유지할 수 없을 때 호출된다 */
export function notifySessionExpired() {
  for (const listener of listeners) listener();
}

/** 구독 해제 함수를 반환한다 (useEffect cleanup에 그대로 쓴다) */
export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
