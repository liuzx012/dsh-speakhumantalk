// 逐字保护层：代码块、行内代码、URL、frontmatter、短引号提及。
// 规则：先挖空成占位符，所有改写只作用于裸文本，最后原样还原。
// 还原后做一次逐字校验 —— 保护类内容漂移一个字节就判失败。

const OPEN = '\u0000DSL'
const TAIL = '\u0000'
const PH = new RegExp(OPEN + '(\\d+)' + TAIL, 'g')

export function protect(input) {
  const store = []
  const put = (s) => {
    store.push(s)
    return OPEN + (store.length - 1) + TAIL
  }
  let out = String(input == null ? '' : input)

  // 顺序要紧：frontmatter → 围栏代码 → 行内代码 → 链接 → 裸 URL → 短引号
  out = out.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, (m) => put(m))
  out = out.replace(/(```|~~~)[\s\S]*?\1/g, (m) => put(m))
  out = out.replace(/`[^`\n]{1,200}`/g, (m) => put(m))
  out = out.replace(/!?\[[^\]\n]{0,120}\]\([^)\n]{0,300}\)/g, (m) => put(m))
  out = out.replace(/\bhttps?:\/\/[^\s)>\]]+/g, (m) => put(m))
  // 短引号：保护被引用的词（use/mention 区分）和直接引语
  out = out.replace(/(["“'])([^"“”'\n]{1,24})\1/g, (m) => put(m))

  return { text: out, store }
}

export function restore(text, store) {
  return String(text).replace(PH, (_, i) => store[Number(i)] ?? '')
}

/** 抽出可比较的保护类内容（用于还原校验） */
export function preservationSnapshot(text) {
  const s = String(text == null ? '' : text)
  const fences = s.match(/(```|~~~)[\s\S]*?\1/g) || []
  const inline = s.match(/`[^`\n]{1,200}`/g) || []
  const urls = s.match(/\bhttps?:\/\/[^\s)>\]]+/g) || []
  const links = s.match(/!?\[[^\]\n]{0,120}\]\([^)\n]{0,300}\)/g) || []
  return { fences, inline, urls, links }
}

/** 校验改写没有动保护类内容 */
export function verifyPreservation(before, after) {
  const a = preservationSnapshot(before)
  const b = preservationSnapshot(after)
  const problems = []
  for (const key of Object.keys(a)) {
    if (a[key].length !== b[key].length) {
      problems.push(`${key}: ${a[key].length} -> ${b[key].length}`)
      continue
    }
    for (let i = 0; i < a[key].length; i += 1) {
      if (a[key][i] !== b[key][i]) {
        problems.push(`${key}[${i}] changed`)
        break
      }
    }
  }
  return { ok: problems.length === 0, problems }
}
