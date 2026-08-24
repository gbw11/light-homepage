import { Fragment, type ReactNode } from "react";
import type { PostBody } from "@/types/api";

/**
 * 게시물 리치텍스트 본문 렌더러 (SPEC_API §3.3 — Tiptap/ProseMirror JSON).
 *
 * ★ **에디터와 렌더러는 반드시 같은 노드 집합을 다뤄야 한다.**
 *   에디터가 만들 수 있는 것을 렌더러가 모르면, 작성자가 쓴 내용이 저장은
 *   되지만 화면에서 조용히 사라진다. 그래서
 *     · 지원 목록은 `types/api.ts`의 `POST_BODY_NODES`/`POST_BODY_MARKS`에
 *       한 번만 적고,
 *     · 에디터 툴바(`PostEditor`)는 그 목록만 노출하고,
 *     · 이 파일이 그 목록 전부를 렌더한다.
 *   툴바를 늘릴 때는 여기도 같이 늘린다.
 *
 * 그래도 모르는 노드를 만나면 **버리지 않고** 안에 있는 글자만이라도
 * 문단으로 흘려보낸다(`fallback`). 백엔드/에디터 버전이 앞서 나가도 글이
 * 통째로 사라지지 않게 하는 안전망이다.
 *
 * 서버 컴포넌트다 — `"use client"`가 없다. 읽기 화면은 상호작용이 없다.
 */

// ── ProseMirror JSON 좁히기 ────────────────────────────────
// 계약상 body.content는 `unknown[]`이다 (types/api.ts). 신뢰하지 않고 좁혀 쓴다.
type PmMark = { type: string; attrs?: Record<string, unknown> };

type PmNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: PmMark[];
  text?: string;
  content?: PmNode[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asNode(v: unknown): PmNode | null {
  if (!isRecord(v) || typeof v.type !== "string") return null;
  return {
    type: v.type,
    attrs: isRecord(v.attrs) ? v.attrs : undefined,
    marks: Array.isArray(v.marks)
      ? v.marks
          .filter(isRecord)
          .filter((m): m is Record<string, unknown> => typeof m.type === "string")
          .map((m) => ({
            type: m.type as string,
            attrs: isRecord(m.attrs) ? m.attrs : undefined,
          }))
      : undefined,
    text: typeof v.text === "string" ? v.text : undefined,
    content: Array.isArray(v.content)
      ? v.content.map(asNode).filter((n): n is PmNode => n !== null)
      : undefined,
  };
}

/**
 * 링크 스킴을 제한한다.
 *
 * ⚠️ 본문은 임원이 쓰지만, 그래도 `javascript:`/`data:` URL을 그대로 `href`에
 *    넣으면 XSS다 (NFR-SEC). 허용 스킴만 통과시키고 나머지는 링크를 만들지
 *    않고 글자만 남긴다.
 */
function safeHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  // 같은 사이트 내 상대 경로는 허용 (프로토콜 상대 `//`는 제외)
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return null;
}

// ── 인라인 (text + marks) ──────────────────────────────────
function renderInline(nodes: PmNode[] | undefined): ReactNode {
  if (!nodes) return null;

  return nodes.map((node, i) => {
    if (node.type === "hardBreak") return <br key={i} />;
    if (node.type !== "text" || node.text === undefined) {
      // text/hardBreak 외의 인라인 노드는 아직 없다 — 안전망으로 자식만 흘린다
      return <Fragment key={i}>{renderInline(node.content)}</Fragment>;
    }

    // 마크는 안쪽부터 감싼다. 순서는 결과에 영향이 없다 (전부 인라인 래퍼)
    let out: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case "bold":
          out = <strong className="font-bold">{out}</strong>;
          break;
        case "italic":
          out = <em className="italic">{out}</em>;
          break;
        case "underline":
          out = <u className="underline">{out}</u>;
          break;
        case "strike":
          out = <s className="line-through">{out}</s>;
          break;
        case "link": {
          const href = safeHref(mark.attrs?.href);
          out = href ? (
            <a
              href={href}
              // 외부 링크만 새 창 — 내부 경로는 같은 탭이 자연스럽다
              {...(href.startsWith("/")
                ? {}
                : { target: "_blank", rel: "noopener noreferrer" })}
              className="text-[var(--color-navy-800)] underline underline-offset-2 hover:opacity-70"
            >
              {out}
            </a>
          ) : (
            out
          );
          break;
        }
        default:
          // 모르는 마크는 서식만 포기하고 글자는 남긴다
          break;
      }
    }
    // key만을 위한 <span>을 남기지 않는다 — 본문 HTML이 span으로 뒤덮이면
    // 스타일·선택 동작이 미묘하게 달라진다
    return <Fragment key={i}>{out}</Fragment>;
  });
}

// ── 블록 ──────────────────────────────────────────────────
function renderBlock(node: PmNode, key: number): ReactNode {
  switch (node.type) {
    case "paragraph":
      // 빈 문단은 작성자가 의도한 줄 간격이다 — 높이를 남긴다
      return node.content?.length ? (
        <p key={key}>{renderInline(node.content)}</p>
      ) : (
        <p key={key} className="h-4" aria-hidden="true" />
      );

    case "heading": {
      // 페이지 제목이 이미 h1이므로 본문 제목은 h2부터 시작한다 (문서 개요 유지)
      const level = Number(node.attrs?.level);
      const Tag = level >= 3 ? "h3" : "h2";
      const cls =
        Tag === "h2" ? "mt-8 text-xl font-bold md:text-2xl" : "mt-6 text-lg font-bold";
      return (
        <Tag key={key} className={cls}>
          {renderInline(node.content)}
        </Tag>
      );
    }

    case "bulletList":
      return (
        <ul key={key} className="list-disc space-y-1 pl-6">
          {renderBlocks(node.content)}
        </ul>
      );

    case "orderedList": {
      const start = Number(node.attrs?.start);
      return (
        <ol
          key={key}
          className="list-decimal space-y-1 pl-6"
          {...(Number.isFinite(start) && start > 1 ? { start } : {})}
        >
          {renderBlocks(node.content)}
        </ol>
      );
    }

    case "listItem":
      // 항목 안은 문단이다. 문단 마진이 항목마다 붙으면 목록이 성기게 보여서 죽인다
      return (
        <li key={key} className="[&>p]:m-0">
          {renderBlocks(node.content)}
        </li>
      );

    case "blockquote":
      return (
        <blockquote
          key={key}
          className="border-l-4 border-[var(--color-navy-100)] pl-4 text-[var(--color-gray-400)]"
        >
          {renderBlocks(node.content)}
        </blockquote>
      );

    case "horizontalRule":
      return <hr key={key} className="border-t border-[var(--color-navy-100)]" />;

    case "hardBreak":
      return <br key={key} />;

    default:
      // ★ 안전망: 모르는 블록도 글자는 살린다 (조용한 손실 방지)
      return <p key={key}>{renderInline(node.content)}</p>;
  }
}

function renderBlocks(nodes: PmNode[] | undefined): ReactNode {
  if (!nodes) return null;
  return nodes.map((n, i) => renderBlock(n, i));
}

export function PostBodyView({
  body,
  className = "",
}: {
  body: PostBody;
  className?: string;
}) {
  const nodes = body.content.map(asNode).filter((n): n is PmNode => n !== null);

  return (
    <div className={`space-y-4 text-base leading-relaxed ${className}`}>
      {renderBlocks(nodes)}
    </div>
  );
}
