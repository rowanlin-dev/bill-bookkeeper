/**
 * 轻量 Markdown 渲染器（零依赖，防 XSS）
 * 支持：### 标题、**加粗**、*斜体*、`代码`、- 无序列表、1. 有序列表、| 表格 |、空行分段
 * 先整体 HTML 转义再做语法替换，AI 输出中的 HTML 不会被执行。
 */

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 行内语法
function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-gray-100 rounded text-[0.85em] font-mono">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '<em>$1</em>')
}

function isTableRow(line) {
  return /^\s*\|.*\|\s*$/.test(line)
}

function isTableDivider(line) {
  return /^\s*\|[\s:|-]+\|\s*$/.test(line) && line.includes('-')
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
}

export function renderMarkdown(text) {
  if (!text) return ''
  const lines = escapeHtml(String(text)).split(/\r?\n/)
  const out = []
  let listType = null // 'ul' | 'ol' | null
  let para = []

  const closeList = () => {
    if (listType) { out.push(listType === 'ul' ? '</ul>' : '</ol>'); listType = null }
  }
  const flushPara = () => {
    if (para.length) { out.push(`<p class="my-1.5">${para.join('<br>')}</p>`); para = [] }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // 表格块
    if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      flushPara(); closeList()
      const headers = splitRow(line)
      const rows = []
      i += 2
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]))
        i++
      }
      const th = headers.map(h => `<th class="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-medium">${inline(h)}</th>`).join('')
      const trs = rows.map(r =>
        `<tr>${r.map(c => `<td class="border border-gray-200 px-2 py-1">${inline(c)}</td>`).join('')}</tr>`
      ).join('')
      out.push(`<table class="my-2 w-full border-collapse text-[0.9em]"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`)
      continue
    }

    // 标题
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      flushPara(); closeList()
      const level = h[1].length
      const cls = level <= 2
        ? 'font-bold text-gray-900 mt-3 mb-1.5 text-base'
        : 'font-semibold text-gray-800 mt-2.5 mb-1 text-sm'
      out.push(`<div class="${cls}">${inline(h[2])}</div>`)
      i++
      continue
    }

    // 无序列表
    const ul = line.match(/^\s*[-*•]\s+(.*)$/)
    if (ul) {
      flushPara()
      if (listType !== 'ul') { closeList(); out.push('<ul class="my-1.5 ml-4 list-disc space-y-0.5">'); listType = 'ul' }
      out.push(`<li>${inline(ul[1])}</li>`)
      i++
      continue
    }

    // 有序列表
    const ol = line.match(/^\s*\d+[.、)]\s+(.*)$/)
    if (ol) {
      flushPara()
      if (listType !== 'ol') { closeList(); out.push('<ol class="my-1.5 ml-4 list-decimal space-y-0.5">'); listType = 'ol' }
      out.push(`<li>${inline(ol[1])}</li>`)
      i++
      continue
    }

    // 空行分段
    if (!line.trim()) {
      flushPara(); closeList()
      i++
      continue
    }

    // 普通行（并入当前段落）
    closeList()
    para.push(inline(line))
    i++
  }

  flushPara(); closeList()
  return out.join('\n')
}
