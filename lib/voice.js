// 声音画像：从一段「本人写的」样本里抽数字，不存正文。
// 只存统计量，理由跟 unslop 一样 —— 存自由文本偏好会持续放大迎合倾向。
import { scan } from './scan.js'
import { writeVoice, readVoice, clearVoice } from './state.js'

export function profileFromSample(sample, label = '') {
  const s = scan(sample)
  // 开场词只留 2 个字符/1 个词，避免把正文带进画像
  const cjkHeavy = (String(sample).match(/[\u4e00-\u9fff]/g) || []).length > (String(sample).match(/[A-Za-z]/g) || []).length
  const openerRe = cjkHeavy
    ? /(?:^|[。！？!?\n])\s*([\u4e00-\u9fff]{1,2})/g
    : /(?:^|[。！？.!?\n])\s*([A-Za-z]{1,12})/g
  const firstWords = []
  let om
  while ((om = openerRe.exec(String(sample)))) firstWords.push(om[1])
  const colonRate = ((String(sample).match(/[：:]/g) || []).length / Math.max(1, s.chars)) * 1000
  const questionRate = ((String(sample).match(/[？?]/g) || []).length / Math.max(1, s.sentences.n)) 
  return {
    label: String(label || '').slice(0, 60),
    createdAt: new Date().toISOString(),
    lang: s.lang,
    chars: s.chars,
    sentenceMean: s.sentences.mean,
    sentenceStdev: s.sentences.stdev,
    sentenceCv: s.sentences.cv,
    sentenceMin: s.sentences.min,
    sentenceMax: s.sentences.max,
    paragraphMean: s.paragraphs.mean,
    contractionRate: s.contractionRate,
    emDashPer1000: s.emDash.per1000,
    bold: s.bold,
    emoji: s.emoji,
    colonPer1000: Math.round(colonRate * 100) / 100,
    questionPerSentence: Math.round(questionRate * 100) / 100,
    openers: [...new Set(firstWords)].slice(0, 12),
  }
}

export function saveVoice(profile) {
  return writeVoice(profile)
}

export function loadVoice() {
  return readVoice()
}

export function removeVoice() {
  return clearVoice()
}

export function formatVoice(v) {
  if (!v) return '未建立声音画像。用 deslop_voice action=sample 传一段你自己写的文字即可建立。'
  return [
    `声音画像${v.label ? `（${v.label}）` : ''} 语言 ${v.lang}，样本 ${v.chars} 单位`,
    `句长 均值 ${v.sentenceMean} σ=${v.sentenceStdev} CV=${v.sentenceCv} 范围 ${v.sentenceMin}–${v.sentenceMax}`,
    `段长 均值 ${v.paragraphMean}｜收缩率 ${v.contractionRate}｜破折号/千字 ${v.emDashPer1000}`,
    `冒号/千字 ${v.colonPer1000}｜问句/句 ${v.questionPerSentence}｜开场词 ${v.openers.join('、') || '—'}`,
    `建立时间 ${v.createdAt}`,
  ].join('\n')
}
