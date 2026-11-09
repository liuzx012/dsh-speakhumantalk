// 确定性改写管道（第一遍清洗稿）。
// 只做「减法」：删套话、换套词、加缩写、破折号配额、过渡词去重、翻案腔拆解。
// 不做：语义重写、事实补全、语气加暖。需要重构请走 skills/deslop 的三遍法。
import {
  EN_STOCK, EN_SYCOPHANCY, EN_HEDGES, EN_FILLER, EN_TRANSITIONS, EN_CONTRACTIONS,
  ZH_OPENERS, ZH_SERVICE, ZH_HEDGE, ZH_MACRO, ZH_COLON_SHELL,
} from './patterns.js'
import { protect, restore, verifyPreservation } from './protect.js'
import { scan, detectLang } from './scan.js'

const MAX_SAMPLES_PER_RULE = 8

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchCase(word, repl) {
  if (!repl) return repl
  if (word === word.toUpperCase() && word.length > 1) return repl.toUpperCase()
  if (word[0] === word[0].toUpperCase()) return repl[0].toUpperCase() + repl.slice(1)
  return repl
}

function makeRecorder() {
  const byRule = new Map()
  const record = (rule, from, to) => {
    if (!byRule.has(rule)) byRule.set(rule, { rule, count: 0, samples: [] })
    const slot = byRule.get(rule)
    slot.count += 1
    if (slot.samples.length < MAX_SAMPLES_PER_RULE) slot.samples.push({ from, to })
  }
  return { record, list: () => [...byRule.values()] }
}

function replaceWords(text, table, recorder, rulePrefix) {
  let out = text
  for (const [word, repl] of Object.entries(table)) {
    const re = new RegExp('\\b' + esc(word) + '\\b', 'gi')
    out = out.replace(re, (m) => {
      const next = matchCase(m, repl)
      recorder.record(`${rulePrefix}:${word}`, m, next)
      return next
    })
  }
  return out
}

function replacePhrases(text, table, recorder, rulePrefix) {
  let out = text
  for (const [phrase, repl] of Object.entries(table)) {
    const re = new RegExp('\\b' + esc(phrase) + '\\b', 'gi')
    out = out.replace(re, (m) => {
      const next = matchCase(m, repl)
      recorder.record(`${rulePrefix}:${phrase}`, m, next)
      return next
    })
  }
  return out
}

function applyAll(text, list, recorder, rule) {
  let out = text
  for (const re of list) {
    out = out.replace(re, (m) => {
      recorder.record(rule, m, '')
      return ''
    })
  }
  return out
}

/** 破折号配额：每段最多 cap 个；纯列表段按每条单独计。 */
function capEmDashes(text, cap, lang, recorder) {
  if (!cap || cap < 0) return text
  const dashChar = lang === 'zh' ? '，' : ', '
  return text
    .split(/\n{2,}/)
    .map((para) => {
      if (!para.trim()) return para
      const lines = para.split('\n')
      const isList = lines.filter((l) => l.trim()).every((l) => /^(?:[-*+]|\d+\.)\s/.test(l.trim()))
      if (isList) {
        return lines
          .map((line) => limitDashes(line, cap, dashChar, recorder))
          .join('\n')
      }
      return limitDashes(para, cap, dashChar, recorder)
    })
    .join('\n\n')
}

function limitDashes(str, cap, dashChar, recorder) {
  let seen = 0
  return str.replace(/——|—|–/g, (m) => {
    seen += 1
    if (seen <= cap) return m
    recorder.record('struct:emdash-cap', m, dashChar)
    return dashChar
  })
}

/** 过渡词去重：每段保留第一个，其余删掉。 */
function dedupeTransitions(text, recorder, limitPerPara = 1) {
  return text
    .split(/\n{2,}/)
    .map((para) => {
      let seen = 0
      return para.replace(EN_TRANSITIONS, (m) => {
        seen += 1
        if (seen <= limitPerPara) return m
        recorder.record('struct:transition-dedupe', m, '')
        return ''
      })
    })
    .join('\n\n')
}

/** 中文翻案腔：不是A，而是B → 是B（主语保留）。A 侧有具体实体则只报不改。 */
function fixFlipZh(text, recorder) {
  const re = /((?:^|[。！？\n])[^。！？\n]{0,12}?)(?:并不是|不是)([^，。；！？\n]{2,14})[，,]\s*(?:而只是|而是|而纯是|只是|纯是|是)([^。！？\n]{2,60})/g
  return text.replace(re, (m, subject, aSide, bSide) => {
    const hasEntity = /[0-9A-Za-z]|公司|服务器|接口|数据库|缓存|线程|进程|链路/.test(aSide)
    if (!subject.trim() || hasEntity) {
      recorder.record('zh:flip-skip', m, m)
      return m
    }
    const next = `${subject}是${bSide}`
    recorder.record('zh:flip', m, next)
    return next
  })
}

/** 加粗当排版：`**词**` 在散文中超过阈值时去掉标记，保留文字。 */
function stripBoldNoise(text, recorder) {
  const total = (text.match(/\*\*/g) || []).length
  if (total <= 6) return text
  const lines = text.split('\n')
  const headingish = /^\s*#{1,6}\s/
  return lines
    .map((line) => {
      if (headingish.test(line)) return line
      if ((line.match(/\*\*/g) || []).length < 2) return line
      const next = line.replace(/\*\*(.+?)\*\*/g, (m, inner) => {
        recorder.record('struct:bold-strip', m, inner)
        return inner
      })
      return next
    })
    .join('\n')
}

function stripEmoji(text, recorder) {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, (m) => {
    recorder.record('struct:emoji', m, '')
    return ''
  })
}

/** 3+ 条同头项目符号 = bullet soup，只报不改（合并要语义判断）。 */
function bulletSoupWarnings(text) {
  const warnings = []
  const groups = text.split(/\n{2,}/)
  for (const g of groups) {
    const lines = g.split('\n').map((l) => l.trim()).filter((l) => /^(?:[-*+]|\d+\.)\s/.test(l))
    if (lines.length < 3) continue
    const heads = lines.map((l) => l.replace(/^(?:[-*+]|\d+\.)\s+/, '').split(/\s+/)[0])
    const seen = new Map()
    for (const h of heads) seen.set(h.toLowerCase(), (seen.get(h.toLowerCase()) || 0) + 1)
    for (const [h, n] of seen) if (n >= 3) warnings.push(`同头项目符号 ${n} 条（首词「${h}」），考虑合并成一句`)
  }
  return warnings
}

export function humanize(input, options = {}) {
  const mode = ['subtle', 'balanced', 'full'].includes(options.mode) ? options.mode : 'balanced'
  const structural = options.structural !== false
  const src = String(input == null ? '' : input)
  const lang = options.lang && options.lang !== 'auto' ? options.lang : detectLang(src)
  const recorder = makeRecorder()
  const skipped = []

  const { text: masked, store } = protect(src)
  let out = masked

  // 三档共用的减法：套词 + 对冲 + 客服腔
  if (lang !== 'zh') {
    out = replaceWords(out, EN_STOCK, recorder, 'en:v')
    out = replacePhrases(out, EN_FILLER, recorder, 'en:f')
    out = applyAll(out, EN_HEDGES, recorder, 'en:hedge')
    out = applyAll(out, EN_SYCOPHANCY, recorder, 'en:sycophancy')
  }
  if (lang !== 'en') {
    out = applyAll(out, ZH_SERVICE, recorder, 'zh:service')
    out = applyAll(out, ZH_HEDGE, recorder, 'zh:hedge')
  }

  if (mode !== 'subtle') {
    if (lang !== 'en') out = applyAll(out, ZH_OPENERS, recorder, 'zh:opener')
    if (lang !== 'en') out = applyAll(out, ZH_MACRO, recorder, 'zh:macro')
    if (lang !== 'en') out = out.replace(ZH_COLON_SHELL, (m) => {
      recorder.record('zh:colon-shell', m, '')
      return ''
    })
    if (lang !== 'zh') {
      const wantContractions = !options.voice || (options.voice.contractionRate ?? 1) >= 0.02
      if (wantContractions) {
        for (const [re, repl] of EN_CONTRACTIONS) {
          out = out.replace(re, (m) => {
            recorder.record('en:contraction', m, repl)
            return repl
          })
        }
      } else {
        skipped.push('声音画像几乎不用缩写，跳过收缩处理')
      }
    }
    if (structural) {
      out = dedupeTransitions(out, recorder, 1)
      const cap = Number.isFinite(options.emDashCap)
        ? options.emDashCap
        : Math.max(1, Math.round(((options.voice?.emDashPer1000 ?? 0) > 6 ? 4 : 2)))
      out = capEmDashes(out, cap, lang, recorder)
    }
  }

  if (mode === 'full') {
    if (lang !== 'en') out = fixFlipZh(out, recorder)
    out = stripBoldNoise(out, recorder)
    out = stripEmoji(out, recorder)
    if (lang !== 'zh') {
      out = applyAll(out, [EN_TRANSITIONS], recorder, 'en:transition-all')
    }
  }

  const result = restore(out, store)

  // 清掉删除规则留下的空行/空格堆
  const cleaned = result
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/(?:^|\n)[ \t]+(?=\S)/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[，,]\s*[，,]/g, '，')
    .trim()

  const preservation = verifyPreservation(src, cleaned)
  const changes = recorder.list().sort((a, b) => b.count - a.count)

  return {
    mode,
    lang,
    text: cleaned,
    changes,
    changed: cleaned !== src,
    warnings: [...bulletSoupWarnings(src), ...skipped],
    preservation,
    before: scan(src, { lang }),
    after: scan(cleaned, { lang }),
  }
}

/** 变更摘要（给人看） */
export function summarize(result) {
  const lines = []
  const delta = result.before.score - result.after.score
  lines.push(`AI 味 ${result.before.score} → ${result.after.score}（${delta >= 0 ? '↓' : '↑'}${Math.abs(delta)}）｜语言 ${result.lang}｜强度 ${result.mode}`)
  if (result.changes.length) {
    lines.push('改动：')
    for (const c of result.changes.slice(0, 14)) {
      const sample = c.samples[0]
      const detail = sample && sample.from !== sample.to
        ? `　例：${JSON.stringify(sample.from)} → ${JSON.stringify(sample.to)}`
        : sample ? `　例：${JSON.stringify(sample.from)}` : ''
      lines.push(`- ${c.rule} ×${c.count}${detail}`)
    }
  } else {
    lines.push('改动：无（原文已经够干净，或全部落在保护区内）')
  }
  if (result.warnings.length) lines.push('提示：' + result.warnings.join('；'))
  if (!result.preservation.ok) lines.push('⚠ 保护区校验失败：' + result.preservation.problems.join(', '))
  else lines.push('保护区校验：通过（代码/URL/行内代码逐字未变）')
  return lines.join('\n')
}
