// AI 味检测与量化：命中项 + 结构性指标（burstiness / 破折号 / 收缩率 / 加粗密度）。
// 只测不改。改写前的基线、改写后的复核都用它。
import {
  EN_STOCK, EN_HEDGES, EN_SYCOPHANCY, ZH_OPENERS, ZH_SERVICE, ZH_HEDGE,
  ZH_MACRO, ZH_COLON_SHELL, REPORT_ONLY,
} from './patterns.js'

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/

export function detectLang(text) {
  const s = String(text || '')
  const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length
  const latin = (s.match(/[A-Za-z]/g) || []).length
  if (cjk === 0 && latin === 0) return 'unknown'
  if (latin === 0) return 'zh'
  if (cjk === 0) return 'en'
  return cjk / (cjk + latin) > 0.25 ? 'zh' : 'en'
}

/** 句子长度以「信息单位」计：中文按字，英文按词 */
function unitsOf(sentence) {
  const cjk = (sentence.match(/[\u4e00-\u9fff]/g) || []).length
  const latin = (sentence.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length
  return cjk + latin
}

export function splitSentences(text) {
  const clean = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/!?\[[^\]\n]*\]\([^)\n]*\)/g, ' ')
    .replace(/\bhttps?:\/\/\S+/g, ' ')
  return clean
    .split(/(?<=[。！？!?；;])|(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => unitsOf(s) > 0)
}

function stats(nums) {
  if (!nums.length) return { n: 0, mean: 0, stdev: 0, cv: 0, min: 0, max: 0 }
  const n = nums.length
  const mean = nums.reduce((a, b) => a + b, 0) / n
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  const stdev = Math.sqrt(variance)
  return {
    n,
    mean: round(mean),
    stdev: round(stdev),
    cv: mean ? round(stdev / mean) : 0,
    min: Math.min(...nums),
    max: Math.max(...nums),
  }
}

function round(x) {
  return Math.round(x * 100) / 100
}

function countMatches(text, re) {
  const global = re.global ? re : new RegExp(re.source, re.flags + 'g')
  const m = text.match(global)
  return m ? m.length : 0
}

function samplesOf(text, re, limit = 2) {
  const global = re.global ? re : new RegExp(re.source, re.flags + 'g')
  const out = []
  let m
  while ((m = global.exec(text)) && out.length < limit) {
    const start = Math.max(0, m.index - 12)
    out.push(text.slice(start, m.index + m[0].length + 12).replace(/\n/g, ' ').trim())
  }
  return out
}

const STOCK_WORD_RE = new RegExp(
  '\\b(' + Object.keys(EN_STOCK).map((w) => w.replace(/[-]/g, '\\-')).join('|') + ')\\b',
  'gi',
)

const FLIP_ZH = /(?:并不是|不是)([^，。；！？\n]{2,14})[，,]\s*(?:而|只|纯)?是([^。！？\n]{2,60})/g
const DUNHAO = /[^，。；！？\n]*、[^，。；！？\n]*、[^，。；！？\n]*、/g

export function scan(input, opts = {}) {
  const text = String(input == null ? '' : input)
  const lang = opts.lang || detectLang(text)
  const sentences = splitSentences(text)
  const lens = sentences.map(unitsOf)
  const sStats = stats(lens)

  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const pStats = stats(paras.map((p) => unitsOf(p)))

  const emDashes = (text.match(/——|—|–/g) || []).length
  const contractions = (text.match(/\b\w+'(?:t|s|re|ve|ll|d|m)\b/gi) || []).length
  const apostropheWords = (text.match(/\b(?:is|are|do|does|did|can|will|would|could|should|not|it|that|there|I|you|we|they|have|has)\b/gi) || []).length
  const bold = (text.match(/\*\*/g) || []).length
  const emoji = (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length
  const chars = (text.match(/[\u4e00-\u9fff]/g) || []).length + (text.match(/[A-Za-z]+/g) || []).length

  const hits = []
  const add = (id, label, count, weight, samples = []) => {
    if (count > 0) hits.push({ id, label, count, weight, samples })
  }

  // 词表
  add('en-stock', '英文 AI 套词', countMatches(text, STOCK_WORD_RE), 6, samplesOf(text, STOCK_WORD_RE))
  add('en-hedge', '英文对冲套话', EN_HEDGES.reduce((a, re) => a + countMatches(text, re), 0), 5)
  add('en-sycophancy', '谄媚开场', EN_SYCOPHANCY.reduce((a, re) => {
    if (!re.test(text)) return a
    re.lastIndex = 0
    return a + 1
  }, 0), 8)

  // 中文
  add('zh-opener', '机械引导词', ZH_OPENERS.reduce((a, re) => a + countMatches(text, re), 0), 6)
  add('zh-service', '客服腔 / 免责垫话', ZH_SERVICE.reduce((a, re) => a + countMatches(text, re), 0), 8)
  add('zh-hedge', '空泛对冲词', ZH_HEDGE.reduce((a, re) => a + countMatches(text, re), 0), 4)
  add('zh-macro', '宏观开场', ZH_MACRO.reduce((a, re) => a + countMatches(text, re), 0), 6)
  add('zh-colon', '冒号提示壳', countMatches(text, ZH_COLON_SHELL), 4)
  add('zh-flip', '翻案腔（不是A而是B）', countMatches(text, FLIP_ZH), 7, samplesOf(text, FLIP_ZH))
  add('zh-dunhao', '顿号罗列过密', countMatches(text, DUNHAO), 4, samplesOf(text, DUNHAO))

  // 只报不改
  for (const rule of REPORT_ONLY[lang] || [...REPORT_ONLY.zh, ...REPORT_ONLY.en]) {
    add(rule.id, rule.label, countMatches(text, rule.re), rule.id.startsWith('zh') ? 6 : 5, samplesOf(text, rule.re))
  }

  // 结构
  const emPer1000 = chars ? round((emDashes / chars) * 1000) : 0
  add('struct-emdash', '破折号过密', emPer1000 > 6 ? Math.ceil(emPer1000 / 6) : 0, 4)
  add('struct-bold', '加粗滥用', bold > 6 ? Math.ceil(bold / 6) : 0, 3)
  add('struct-emoji', 'emoji 当排版', emoji > 2 ? emoji - 2 : 0, 2)

  const contractionRate = apostropheWords ? round(contractions / apostropheWords) : 0
  let structuralPenalty = 0
  const notes = []
  if (sStats.n >= 4 && sStats.cv < 0.3) {
    structuralPenalty += 18
    notes.push(`句长变异系数 ${sStats.cv}（<0.30 视为平铺，人写通常 0.45+）`)
  } else if (sStats.n >= 4 && sStats.cv < 0.45) {
    structuralPenalty += 8
    notes.push(`句长变异系数 ${sStats.cv}，偏整齐`)
  }
  if (pStats.n >= 3 && pStats.stdev < 20) {
    structuralPenalty += 6
    notes.push(`段长标准差 ${pStats.stdev}，段落过于等长`)
  }
  if (lang === 'en' && contractionRate < 0.05 && chars > 80) {
    structuralPenalty += 6
    notes.push(`收缩率 ${contractionRate}，英文正文几乎没有缩写`)
  }

  const weighted = hits.reduce((a, h) => a + h.count * h.weight, 0)
  const score = Math.min(100, Math.round(weighted + structuralPenalty))
  const verdict = score < 15 ? '人味足' : score < 35 ? '轻微 AI 味' : score < 60 ? '明显 AI 味' : '浓重 AI 味'

  return {
    lang,
    chars,
    sentences: sStats,
    paragraphs: pStats,
    emDash: { total: emDashes, per1000: emPer1000 },
    contractionRate,
    bold,
    emoji,
    hits: hits.sort((a, b) => b.count * b.weight - a.count * a.weight),
    structuralPenalty,
    notes,
    score,
    verdict,
  }
}

/** 简短可读报表 */
export function formatScan(result) {
  const lines = []
  lines.push(`AI 味评分 ${result.score}/100 —— ${result.verdict}（语言 ${result.lang}，${result.chars} 单位）`)
  lines.push(`句长：n=${result.sentences.n} 均值 ${result.sentences.mean} σ=${result.sentences.stdev} CV=${result.sentences.cv} 范围 ${result.sentences.min}–${result.sentences.max}`)
  lines.push(`破折号 ${result.emDash.total}（每千字 ${result.emDash.per1000}）｜加粗 ${result.bold}｜emoji ${result.emoji}｜收缩率 ${result.contractionRate}`)
  if (result.hits.length) {
    lines.push('命中：')
    for (const h of result.hits.slice(0, 12)) {
      lines.push(`- [${h.id}] ${h.label} ×${h.count}${h.samples.length ? `　例：${h.samples.join(' ／ ')}` : ''}`)
    }
  } else {
    lines.push('命中：无')
  }
  if (result.notes.length) lines.push('结构：' + result.notes.join('；'))
  return lines.join('\n')
}
