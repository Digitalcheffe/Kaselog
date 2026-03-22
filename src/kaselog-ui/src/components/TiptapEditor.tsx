import { useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditorState } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, all } from 'lowlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import Focus from '@tiptap/extension-focus'
import Mathematics from '@tiptap/extension-mathematics'
import 'katex/dist/katex.min.css'
import { Markdown } from '@tiptap/markdown'
import './TiptapEditor.css'

// ── Resizable image node view ─────────────────────────────────────────────────

function ResizableImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const startX = useRef(0)
  const startW = useRef(0)
  const imgRef = useRef<HTMLImageElement>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startX.current = e.clientX
    startW.current = (node.attrs.width as number) || imgRef.current?.naturalWidth || 300

    const onMove = (me: MouseEvent) => {
      const newW = Math.max(50, startW.current + (me.clientX - startX.current))
      updateAttributes({ width: newW })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [node.attrs.width, updateAttributes])

  return (
    <NodeViewWrapper style={{ display: 'inline-block', position: 'relative', maxWidth: '100%' }}>
      <img
        ref={imgRef}
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string) ?? ''}
        width={(node.attrs.width as number) ?? undefined}
        style={{ display: 'block', maxWidth: '100%', borderRadius: 6 }}
      />
      {selected && (
        <div className="resize-handle" onMouseDown={onMouseDown} />
      )}
    </NodeViewWrapper>
  )
}

// ── Resizable image extension ─────────────────────────────────────────────────

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView)
  },
})

// ── Lowlight ──────────────────────────────────────────────────────────────────

const lowlight = createLowlight(all)

// ── Toolbar helpers ───────────────────────────────────────────────────────────

function TbBtn({
  label,
  active,
  onClick,
  title,
}: {
  label: React.ReactNode
  active?: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      style={{
        padding: '4px 7px',
        borderRadius: 5,
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        color: active ? 'var(--accent)' : 'var(--text-tertiary)',
        background: active ? 'var(--accent-light)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        minWidth: 26,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        flexShrink: 0,
        fontFamily: 'var(--font)',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

function TbSep() {
  return (
    <span style={{
      width: 1,
      height: 14,
      background: 'var(--border-mid)',
      margin: '0 3px',
      flexShrink: 0,
      display: 'inline-block',
    }} />
  )
}

// ── Inline BubbleMenu (Tiptap v3 — no React BubbleMenu component) ─────────────

function InlineBubbleMenu({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const { selection, isEmpty } = useEditorState({
    editor,
    selector: (ctx) => ({
      selection: ctx.editor?.state.selection,
      isEmpty: ctx.editor?.state.selection.empty ?? true,
    }),
  })

  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!editor || isEmpty || !selection) {
      setPos(null)
      return
    }
    try {
      const { from, to } = selection
      const startCoords = editor.view.coordsAtPos(from)
      const endCoords = editor.view.coordsAtPos(to)
      const left = (startCoords.left + endCoords.right) / 2
      const top = Math.min(startCoords.top, endCoords.top) - 44
      setPos({ top, left })
    } catch {
      setPos(null)
    }
  }, [editor, selection, isEmpty])

  if (!editor || isEmpty || !pos) return null

  return (
    <div
      className="bubble-menu"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translateX(-50%)',
        zIndex: 100,
      }}
    >
      <button className={`bubble-btn${editor.isActive('bold') ? ' is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}>
        <b>B</b>
      </button>
      <button className={`bubble-btn${editor.isActive('italic') ? ' is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}>
        <i>I</i>
      </button>
      <button className={`bubble-btn${editor.isActive('underline') ? ' is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run() }}>
        <u>U</u>
      </button>
      <button className={`bubble-btn${editor.isActive('strike') ? ' is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run() }}>
        <s>S</s>
      </button>
      <span className="bubble-sep" />
      <button className={`bubble-btn${editor.isActive('code') ? ' is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCode().run() }}>
        {'</>'}
      </button>
      <button className={`bubble-btn${editor.isActive('highlight') ? ' is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHighlight().run() }}>
        H
      </button>
      <span className="bubble-sep" />
      <button className={`bubble-btn${editor.isActive('subscript') ? ' is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleSubscript().run() }}>
        X<sub>2</sub>
      </button>
      <button className={`bubble-btn${editor.isActive('superscript') ? ' is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleSuperscript().run() }}>
        X<sup>2</sup>
      </button>
      <span className="bubble-sep" />
      <button
        className={`bubble-btn${editor.isActive('link') ? ' is-active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          const url = window.prompt('URL:')
          if (url) editor.chain().focus().setLink({ href: url }).run()
          else editor.chain().focus().unsetLink().run()
        }}
      >
        Link
      </button>
    </div>
  )
}

// Need React for JSX in the BubbleMenu component
import React from 'react'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TiptapEditorProps {
  /** Markdown string (stored format). Parsed natively by the Markdown extension. */
  content: string
  /** Called with a markdown string whenever the editor content changes. */
  onChange: (markdown: string) => void
  onImageUpload: (file: File) => Promise<string>
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TiptapEditor({ content, onChange, onImageUpload }: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      ResizableImage.configure({ allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Underline,
      Highlight,
      Subscript,
      Superscript,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      CharacterCount,
      Typography,
      Focus,
      Mathematics,
      Markdown.configure({
        indentation: { style: 'space', size: 2 },
      }),
    ],
    content: content || '',
    // Tell the Markdown extension to parse the initial content as markdown
    contentType: 'markdown',
    onUpdate({ editor: ed }) {
      onChange(ed.getMarkdown())
    },
    editorProps: {
      handlePaste(_view, event) {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) {
              event.preventDefault()
              void handleImageFile(file)
              return true
            }
          }
        }
        return false
      },
      handleDrop(_view, event) {
        const files = event.dataTransfer?.files
        if (!files?.length) return false
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
        if (!imageFiles.length) return false
        event.preventDefault()
        void handleImageFile(imageFiles[0])
        return true
      },
    },
  })

  async function handleImageFile(file: File) {
    const url = await onImageUpload(file)
    editor?.chain().focus().setImage({ src: url }).run()
  }

  // Sync content when prop changes (e.g. version restore).
  // The Markdown extension parses the markdown string natively.
  useEffect(() => {
    if (!editor) return
    const current = editor.getMarkdown()
    if (current.trim() !== (content || '').trim()) {
      editor.commands.setContent(content || '', { contentType: 'markdown' })
    }
  }, [content, editor])

  if (!editor) return null

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs)

  return (
    <div className="tiptap-editor" style={{ width: '100%' }}>
      {/* ── Structural toolbar ── */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem',
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg)',
        height: 36,
        minHeight: 36,
        flexShrink: 0,
        overflowX: 'auto',
        gap: 0,
      }}>
        {/* Text structure */}
        <TbBtn label="H1" active={isActive('heading', { level: 1 })} title="Heading 1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <TbBtn label="H2" active={isActive('heading', { level: 2 })} title="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <TbBtn label="H3" active={isActive('heading', { level: 3 })} title="Heading 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <TbSep />
        {/* Lists */}
        <TbBtn label="≡" active={isActive('bulletList')} title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <TbBtn label="1." active={isActive('orderedList')} title="Ordered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <TbBtn label="☐" active={isActive('taskList')} title="Task list"
          onClick={() => editor.chain().focus().toggleTaskList().run()} />
        <TbSep />
        {/* Blocks */}
        <TbBtn label="</>" active={isActive('codeBlock')} title="Code block"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        <TbBtn label={'"'} active={isActive('blockquote')} title="Blockquote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <TbBtn label="∑" title="Math / LaTeX" active={false}
          onClick={() => {
            editor.chain().focus().insertContent('$$').run()
          }} />
        <TbSep />
        {/* Insert */}
        <TbBtn label="⊞" title="Insert table" active={false}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()} />
        <TbBtn label="🖼" title="Upload image" active={false}
          onClick={() => fileInputRef.current?.click()} />
        <TbBtn label="—" title="Horizontal rule" active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <TbSep />
        {/* Alignment */}
        <TbBtn label="←" title="Align left"
          active={isActive('paragraph', { textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()} />
        <TbBtn label="↔" title="Align center"
          active={isActive('paragraph', { textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()} />
        <TbBtn label="→" title="Align right"
          active={isActive('paragraph', { textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()} />
        <TbSep />
        {/* History */}
        <TbBtn label="↩" title="Undo" active={false}
          onClick={() => editor.chain().focus().undo().run()} />
        <TbBtn label="↪" title="Redo" active={false}
          onClick={() => editor.chain().focus().redo().run()} />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file) await handleImageFile(file)
          e.target.value = ''
        }}
      />

      {/* ── Inline BubbleMenu ── */}
      <InlineBubbleMenu editor={editor} />

      {/* ── Editor canvas ── */}
      <EditorContent editor={editor} />
    </div>
  )
}
