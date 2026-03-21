import MarkdownIt from 'markdown-it'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — no types package for markdown-it-task-lists
import taskLists from 'markdown-it-task-lists'
import { MarkdownSerializer, defaultMarkdownSerializer } from 'prosemirror-markdown'
import type { Editor } from '@tiptap/core'
import type { Mark, Node } from '@tiptap/pm/model'

// ── markdown-it instance (markdown → HTML) ────────────────────────────────────

const md = new MarkdownIt({
  html: true,       // allow inline HTML so <u>, <mark>, <sub>, <sup> round-trip
  breaks: false,
  linkify: true,
  typographer: false,
}).use(taskLists, { enabled: true, label: true })

// Enable tables (built-in markdown-it plugin)
md.enable('table')

/**
 * Convert a markdown string to HTML suitable for passing to
 * editor.commands.setContent().
 *
 * Returns empty string for null / whitespace-only input so the caller can
 * detect "no content" without running it through the parser.
 */
export function markdownToHtml(markdown: string | null | undefined): string {
  if (!markdown || !markdown.trim()) return ''
  return md.render(markdown)
}

// ── Custom ProseMirror → markdown serializer ──────────────────────────────────

function tableToMarkdown(node: Node): string {
  const rows: string[][] = []
  node.forEach((row) => {
    const cells: string[] = []
    row.forEach((cell) => {
      cells.push(cell.textContent.replace(/\|/g, '\\|').trim())
    })
    rows.push(cells)
  })
  if (rows.length === 0) return ''
  const colCount = rows[0].length
  const header = '| ' + rows[0].join(' | ') + ' |'
  const separator = '| ' + Array(colCount).fill('---').join(' | ') + ' |'
  const body = rows.slice(1).map(r => '| ' + r.join(' | ') + ' |').join('\n')
  return [header, separator, ...(body ? [body] : [])].join('\n') + '\n\n'
}

const serializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,

    // ── Task list ──────────────────────────────────────────────────────────
    taskList(state, node) {
      state.renderList(node, '  ', (i: number) => {
        const item = node.child(i)
        const checked = item.attrs.checked ? '[x]' : '[ ]'
        return `- ${checked} `
      })
    },
    taskItem(state, node) {
      state.renderContent(node)
    },

    // ── Table ─────────────────────────────────────────────────────────────
    table(state, node) {
      state.write(tableToMarkdown(node))
    },
    tableRow(_state, _node) { /* handled by table */ },
    tableCell(_state, _node) { /* handled by table */ },
    tableHeader(_state, _node) { /* handled by table */ },

    // ── Math (serialize as LaTeX delimiters) ───────────────────────────────
    mathInline(state, node) {
      state.write(`$${node.textContent}$`)
    },
    mathDisplay(state, node) {
      state.write(`$$\n${node.textContent}\n$$`)
      state.closeBlock(node)
    },
  },
  {
    ...defaultMarkdownSerializer.marks,

    // ── Strikethrough ──────────────────────────────────────────────────────
    strike: {
      open: '~~',
      close: '~~',
      mixable: true,
      expelEnclosingWhitespace: true,
    },

    // ── Underline (no standard markdown → HTML tag) ────────────────────────
    underline: {
      open: '<u>',
      close: '</u>',
      mixable: true,
      expelEnclosingWhitespace: true,
    },

    // ── Highlight ──────────────────────────────────────────────────────────
    highlight: {
      open: '<mark>',
      close: '</mark>',
      mixable: true,
    },

    // ── Subscript / superscript ────────────────────────────────────────────
    subscript: {
      open: '<sub>',
      close: '</sub>',
      mixable: true,
    },
    superscript: {
      open: '<sup>',
      close: '</sup>',
      mixable: true,
    },

    // ── Text style (color, font-size — serialize as inline span) ──────────
    textStyle: {
      open(_state: unknown, mark: Mark) {
        const color = mark.attrs.color as string | null
        return color ? `<span style="color:${color}">` : ''
      },
      close(_state: unknown, mark: Mark) {
        const color = mark.attrs.color as string | null
        return color ? '</span>' : ''
      },
      mixable: true,
    },
  },
)

/**
 * Serialize the editor's current ProseMirror document to a markdown string.
 * Falls back to plain text if the serializer encounters an unknown node type.
 */
export function editorToMarkdown(editor: Editor): string {
  try {
    return serializer.serialize(editor.state.doc)
  } catch {
    return editor.getText()
  }
}
