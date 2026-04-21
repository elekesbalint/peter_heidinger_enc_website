"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, type ReactNode } from "react";

import { looksLikeLegalHtml, plainLegalTextToHtml } from "@/lib/legal-content";

type LegalRichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
};

function toEditorHtml(stored: string): string {
  const t = stored.trim();
  if (!t) return "<p></p>";
  if (looksLikeLegalHtml(t)) return t;
  return plainLegalTextToHtml(t);
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export function LegalRichEditor({ value, onChange, disabled }: LegalRichEditorProps) {
  const skipNextExternalSync = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Írd ide a dokumentum szövegét…",
      }),
    ],
    content: "<p></p>",
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "tiptap-legal min-h-[320px] px-4 py-3 text-sm text-slate-800 outline-none focus:outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      skipNextExternalSync.current = true;
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    if (skipNextExternalSync.current) {
      skipNextExternalSync.current = false;
      return;
    }
    const next = toEditorHtml(value);
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
        Szerkesztő betöltése…
      </div>
    );
  }

  const d = !!disabled;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <ToolbarButton
          title="Félkövér"
          disabled={d}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          title="Dőlt"
          disabled={d}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>

        <span className="mx-0.5 w-px self-stretch bg-slate-200" aria-hidden />

        <ToolbarButton
          title="Szekció fejléc (## stílus)"
          disabled={d}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          Fejléc
        </ToolbarButton>
        <ToolbarButton
          title="Fejezet cím (1. / 2. stílus)"
          disabled={d}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          Fejezet
        </ToolbarButton>
        <ToolbarButton
          title="Bekezdés"
          disabled={d}
          active={editor.isActive("paragraph")}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          Bekezdés
        </ToolbarButton>

        <span className="mx-0.5 w-px self-stretch bg-slate-200" aria-hidden />

        <ToolbarButton
          title="Számozott lista"
          disabled={d}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. Lista
        </ToolbarButton>
        <ToolbarButton
          title="Felsorolás"
          disabled={d}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • Lista
        </ToolbarButton>

        <span className="mx-0.5 w-px self-stretch bg-slate-200" aria-hidden />

        <ToolbarButton
          title="Vízszintes elválasztó"
          disabled={d}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          ─
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />

      {/* Format guide */}
      <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span className="font-medium">Útmutató:</span>{" "}
        <span className="font-semibold text-primary">Fejléc</span> = szekció (pl. „Általános tudnivalók") ·{" "}
        <span className="font-semibold text-primary">Fejezet</span> = alfejezet (pl. „1.1. Szöveg") ·{" "}
        <span className="font-semibold text-primary">Bekezdés</span> = sima szöveg ·{" "}
        <kbd className="rounded bg-slate-200 px-1">Enter</kbd> = új sor ugyanabban a blokkban ·{" "}
        <kbd className="rounded bg-slate-200 px-1">Shift+Enter</kbd> = sortörés a bekezdésen belül
      </div>
    </div>
  );
}
