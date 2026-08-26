import type { PostBody } from "@/types/api";

/**
 * 본문(PostBody) 값 유틸 — **Tiptap을 모르는 모듈**이다.
 *
 * PostEditor.tsx에 두지 않는 이유: 폼(PostForm)은 초기값·빈 본문 검증에
 * 이 두 개가 동기적으로 필요할 뿐인데, 같은 모듈에 있으면 에디터를
 * `next/dynamic`으로 미뤄도 tiptap+ProseMirror(빌드 최대 청크)가 함께
 * 끌려 들어와 분리가 무의미해진다.
 */

/** 빈 본문 — 스펙 §3.3의 `{ type: "doc", content: [] }` 형태 */
export const EMPTY_POST_BODY: PostBody = { type: "doc", content: [] };

/** 본문이 실제로 비었는지 (빈 문단 하나만 있는 상태도 "빔"으로 본다) */
export function isPostBodyEmpty(body: PostBody): boolean {
  return !body.content.some((node) => {
    if (typeof node !== "object" || node === null) return false;
    const n = node as { type?: unknown; content?: unknown; text?: unknown };
    if (n.type === "horizontalRule") return true;
    return Array.isArray(n.content) && n.content.length > 0;
  });
}
