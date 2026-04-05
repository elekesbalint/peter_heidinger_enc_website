"use client";

import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, type ReactNode } from "react";

import { looksLikeBlogHtml, plainBlogTextToHtml } from "@/lib/blog-content-plain";

type BlogRichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
};

function toEditorHtml(stored: string): string {
  const t = stored.trim();
  if (!t) return "<p></p>";
  if (looksLikeBlogHtml(t)) return t;
  return plainBlogTextToHtml(t);
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
        active ? "border-primary bg-primary/15 text-primary" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export function BlogRichEditor({ value, onChange, disabled }: BlogRichEditorProps) {
  const skipNextExternalSync = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            rel: "noopener noreferrer",
            target: "_blank",
          },
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: "Írd ide a cikk szövegét…",
      }),
    ],
    content: "<p></p>",
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "tiptap-prose min-h-[220px] px-3 py-2 text-sm text-slate-800 outline-none focus:outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      skipNextExternalSync.current = true;
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
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

  const addImageFromUrl = () => {
    const url = window.prompt("Kép URL (https:// vagy data:)")?.trim();
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const addImageFromFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file || file.size > 5 * 1024 * 1024) {
        window.alert("Legfeljebb 5 MB-os képet válassz.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = typeof reader.result === "string" ? reader.result : "";
        if (src) editor.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://")?.trim();
    if (url === undefined) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const d = !!disabled;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
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
        <ToolbarButton
          title="Aláhúzás"
          disabled={d}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </ToolbarButton>
        <span className="mx-0.5 w-px self-stretch bg-slate-200" aria-hidden />
        <ToolbarButton
          title="Címsor 1"
          disabled={d}
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          title="Címsor 2"
          disabled={d}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Címsor 3"
          disabled={d}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          title="Bekezdés"
          disabled={d}
          active={editor.isActive("paragraph")}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          P
        </ToolbarButton>
        <span className="mx-0.5 w-px self-stretch bg-slate-200" aria-hidden />
        <ToolbarButton
          title="Felsorolás"
          disabled={d}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • Lista
        </ToolbarButton>
        <ToolbarButton
          title="Számozott lista"
          disabled={d}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. Lista
        </ToolbarButton>
        <ToolbarButton
          title="Idézet"
          disabled={d}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          „”
        </ToolbarButton>
        <span className="mx-0.5 w-px self-stretch bg-slate-200" aria-hidden />
        <ToolbarButton title="Link" disabled={d} active={editor.isActive("link")} onClick={setLink}>
          Link
        </ToolbarButton>
        <ToolbarButton title="Kép URL" disabled={d} onClick={addImageFromUrl}>
          Kép URL
        </ToolbarButton>
        <ToolbarButton title="Kép feltöltés" disabled={d} onClick={addImageFromFile}>
          Kép fájl
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
