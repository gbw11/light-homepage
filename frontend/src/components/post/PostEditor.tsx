"use client";

import { useCallback } from "react";
import type { Editor, JSONContent } from "@tiptap/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { PostBody } from "@/types/api";

/**
 * 리치텍스트 본문 에디터 (Tiptap — WORKPLAN.md §3.1 · §11.1 결정, FR-DOC-01).
 *
 * ★ **툴바 = `PostBodyView`가 렌더할 수 있는 것, 정확히 그만큼.**
 *   에디터가 렌더러보다 앞서 나가면 작성자가 쓴 내용이 저장은 되지만 화면에서
 *   사라진다. 그래서 짝인 렌더러와 **같은 디렉터리**에 두었다 — 한쪽만 고치면
 *   안 되는 파일이라는 걸 위치로 드러낸다. 지원 목록은
 *   `types/api.ts`의 `POST_BODY_NODES`/`POST_BODY_MARKS`가 기준이다.
 *
 *   그래서 StarterKit에서 **`code`·`codeBlock`을 끈다.** 렌더러가 코드 블록을
 *   모르는데 켜두면 ``Ctrl+E``·백틱 세 개 같은 기본 단축키로 작성자가 실수로
 *   만들 수 있다. 이미지(와이어프레임 §16의 📷)도 같은 이유로 넣지 않았다 —
 *   본문 이미지용 계약(§3.3 body 안의 이미지 노드·URL)이 아직 없다.
 *
 * 편집 상태는 Tiptap이 들고 있고, 밖으로는 `onChange(PostBody)`로만 나간다.
 * 부모(작성 화면)는 ProseMirror를 몰라도 된다.
 */

type ToolbarButtonProps = {
  label: string;
  /** 버튼에 보일 짧은 표기 (B, I, …) */
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function ToolbarButton({ label, children, active, disabled, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      // 아이콘만 있는 버튼이라 접근 가능한 이름을 따로 준다 (COMPONENTS.md §4)
      aria-label={label}
      title={label}
      aria-pressed={active ?? false}
      disabled={disabled}
      // ⚠️ mousedown에서 기본동작을 막아야 한다. 버튼을 누르는 순간 에디터가
      //    포커스를 잃으면 선택 영역이 사라져서 서식이 엉뚱하게 적용된다.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-9 min-w-9 rounded-md px-2 text-sm font-bold transition-colors disabled:opacity-40 ${
        active
          ? "bg-[var(--color-navy-900)] text-white"
          : "text-[var(--color-ink)] hover:bg-[var(--color-navy-100)]"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  /**
   * Tiptap v3의 `useEditor`는 트랜잭션마다 리렌더하지 않는다. 툴바의 눌림
   * 상태(active)를 커서 위치에 맞춰 갱신하려면 `useEditorState`로 필요한 값만
   * 구독한다 — 전체 리렌더보다 싸고, 이게 v3의 정식 방법이다.
   */
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const toggleLink = useCallback(() => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const previous = String(editor.getAttributes("link").href ?? "");
    // 링크 입력은 별도 팝오버가 정석이지만, 작성 화면 첫 단위에서는 prompt로
    // 기능을 먼저 세운다. 팝오버는 이 위에 얹으면 되고 계약은 바뀌지 않는다.
    const url = window.prompt("링크 주소를 입력하세요 (http:// 포함)", previous || "https://");
    if (url === null) return; // 취소
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url.trim() }).run();
  }, [editor]);

  return (
    <div
      role="toolbar"
      aria-label="본문 서식"
      className="flex flex-wrap items-center gap-1 border-b border-[var(--color-navy-100)] p-1.5"
    >
      <ToolbarButton label="굵게" active={state?.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        B
      </ToolbarButton>
      <ToolbarButton label="기울임" active={state?.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton label="밑줄" active={state?.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton label="취소선" active={state?.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </ToolbarButton>

      <span className="mx-1 h-6 w-px bg-[var(--color-navy-100)]" aria-hidden="true" />

      {/* 본문 제목은 h2부터 — 페이지 제목이 이미 h1이다 (PostBodyView와 동일 규칙) */}
      <ToolbarButton
        label="제목"
        active={state?.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        제목
      </ToolbarButton>
      <ToolbarButton
        label="소제목"
        active={state?.h3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        소제목
      </ToolbarButton>

      <span className="mx-1 h-6 w-px bg-[var(--color-navy-100)]" aria-hidden="true" />

      <ToolbarButton
        label="글머리표 목록"
        active={state?.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •≡
      </ToolbarButton>
      <ToolbarButton
        label="번호 목록"
        active={state?.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1≡
      </ToolbarButton>
      <ToolbarButton
        label="인용"
        active={state?.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        ❝
      </ToolbarButton>
      <ToolbarButton label="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        —
      </ToolbarButton>
      <ToolbarButton label="링크" active={state?.link} onClick={toggleLink}>
        🔗
      </ToolbarButton>

      <span className="mx-1 h-6 w-px bg-[var(--color-navy-100)]" aria-hidden="true" />

      <ToolbarButton
        label="되돌리기"
        disabled={!state?.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↩
      </ToolbarButton>
      <ToolbarButton
        label="다시 실행"
        disabled={!state?.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↪
      </ToolbarButton>
    </div>
  );
}

export function PostEditor({
  value,
  onChange,
  disabled = false,
}: {
  /** 초기 본문. 이후 값은 에디터가 들고 있다 (제어 컴포넌트가 아니다) */
  value: PostBody;
  onChange: (body: PostBody) => void;
  disabled?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 렌더러가 다루지 않는 것은 아예 만들 수 없게 막는다 (위 주석 참고)
        code: false,
        codeBlock: false,
        heading: { levels: [2, 3] },
        // 편집 중에 링크를 클릭하면 페이지가 떠버린다 — 편집기에서는 열지 않는다
        link: { openOnClick: false },
      }),
    ],
    /**
     * 계약(`PostBody`)의 `content`는 `unknown[]`이다 — 노드 스키마를 API 타입에
     * 박아두지 않기 위한 의도적 선택이다(types/api.ts). Tiptap의 `JSONContent`와
     * 구조는 같으므로 여기서만 좁혀 넘긴다. Tiptap은 스키마에 없는 노드를
     * 조용히 버리므로, 이 캐스트가 잘못된 문서를 통과시키지도 않는다.
     */
    content: value as JSONContent,
    editable: !disabled,
    // ⚠️ SSR에서 즉시 렌더하면 hydration 불일치가 난다 (Tiptap이 DOM을 직접 만든다)
    immediatelyRender: false,
    editorProps: {
      attributes: {
        // `outline-none`은 Tiptap이 자체 커서를 그리기 때문 — 포커스는 바깥 테두리가 보여준다
        class: "min-h-56 px-3 py-3 outline-none",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as PostBody),
  });

  if (!editor) {
    // immediatelyRender:false면 첫 렌더에 editor가 없다. 높이를 미리 잡아
    // 레이아웃이 튀지 않게 한다
    return (
      <div className="h-72 rounded-xl border border-[var(--color-navy-100)] bg-white" aria-hidden="true" />
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-navy-100)] bg-white focus-within:border-[var(--color-navy-900)]">
      <Toolbar editor={editor} />
      {/*
        에디터 안쪽 서식은 PostBodyView와 눈으로 같아야 한다 — 작성 화면에서
        본 모양과 읽기 화면이 다르면 그것도 "쓴 게 사라진 것"처럼 느껴진다.
      */}
      <EditorContent
        editor={editor}
        className="text-base leading-relaxed [&_.ProseMirror>*+*]:mt-4 [&_a]:text-[var(--color-navy-800)] [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--color-navy-100)] [&_blockquote]:pl-4 [&_blockquote]:text-[var(--color-gray-400)] [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-bold [&_hr]:border-t [&_hr]:border-[var(--color-navy-100)] [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
  );
}
