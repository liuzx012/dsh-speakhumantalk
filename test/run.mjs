// 自检：node test/run.mjs
// 不引测试框架，失败即退出码 1。
import assert from 'node:assert/strict'
import { humanize } from '../lib/humanize.js'
import { scan, detectLang } from '../lib/scan.js'
import { protect, restore } from '../lib/protect.js'
import { buildSection } from '../lib/prompt.js'
import { profileFromSample } from '../lib/voice.js'

let passed = 0
const failures = []
function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`ok   ${name}`)
  } catch (err) {
    failures.push({ name, err })
    console.log(`FAIL ${name}\n     ${err.message.split('\n')[0]}`)
  }
}

// ── 保护层 ────────────────────────────────────────────────────────
test('保护层：代码块/URL/行内代码原样还原', () => {
  const src = '看这段 ```js\nconst a = delve(1)\n``` 还有 `leverage()` 和 https://x.dev/a?b=1'
  const { text, store } = protect(src)
  assert.equal(text.includes('delve'), false)
  const back = restore(text, store)
  assert.equal(back, src)
})

// ── 英文改写 ──────────────────────────────────────────────────────
const EN_SLOP = [
  "Great question! Certainly, I'd be happy to help.",
  "It's important to note that this robust and seamless solution leverages cutting-edge paradigms to facilitate holistic outcomes.",
  'Furthermore, it delves into the realm of performance. Moreover, it utilizes a plethora of techniques.',
  'You do not need to run it twice. It is fine.',
  'See `pnpm run build` and https://example.com/docs for details.',
  '```js',
  'const delve = leverage(1)',
  '```',
].join('\n')

test('英文改写：套词/谄媚/对冲被清掉', () => {
  const r = humanize(EN_SLOP, { mode: 'balanced' })
  const prose = r.text.replace(/```[\s\S]*?```/g, ' ') // 代码块里的词不算残留
  for (const bad of ['delve', 'leverage', 'seamless', 'robust', 'cutting-edge', 'holistic', 'plethora']) {
    assert.equal(new RegExp(`\\b${bad}\\b`, 'i').test(prose), false, `残留 ${bad}`)
  }
  assert.equal(/great question/i.test(prose), false)
  assert.equal(/it'?s important to note/i.test(prose), false)
})

test('英文改写：保护区逐字未变', () => {
  const r = humanize(EN_SLOP, { mode: 'full' })
  assert.equal(r.preservation.ok, true, JSON.stringify(r.preservation.problems))
  assert.ok(r.text.includes('const delve = leverage(1)'), '代码块被改了')
  assert.ok(r.text.includes('https://example.com/docs'), 'URL 被改了')
  assert.ok(r.text.includes('`pnpm run build`'), '行内代码被改了')
})

test('英文改写：收缩形式生效、评分下降', () => {
  const r = humanize(EN_SLOP, { mode: 'balanced' })
  assert.ok(r.after.score < r.before.score, `score ${r.before.score} -> ${r.after.score}`)
  assert.ok(/don't|it's/i.test(r.text), '没有加缩写')
})

// ── 中文改写 ──────────────────────────────────────────────────────
const ZH_SLOP = [
  '好问题！说白了，这不是一次普通的版本更新，而是一次范式转移。',
  '从某种程度上说，这意味着团队的能力有了显著提升。事实上，这个过程赋能了所有人。',
  '综上所述，希望这对你有帮助。',
].join('\n')

test('中文改写：客服腔/引导词/对冲词清掉', () => {
  const r = humanize(ZH_SLOP, { mode: 'balanced', lang: 'zh' })
  for (const bad of ['好问题', '说白了', '从某种程度上说', '事实上', '希望这对你有帮助', '综上所述']) {
    assert.equal(r.text.includes(bad), false, `残留 ${bad}`)
  }
})

test('中文改写：翻案腔拆成肯定句', () => {
  const r = humanize(ZH_SLOP, { mode: 'full', lang: 'zh' })
  assert.equal(/不是[^，。]{2,14}[，,](?:而|只)?是/.test(r.text), false, `未拆解：${r.text}`)
  assert.ok(r.text.includes('这是一次范式转移'), `拆解结果不对：${r.text}`)
})

test('中文改写：A 侧是具体实体时不硬拆', () => {
  const src = '不是 Redis 的问题，而是连接池打满了。'
  const r = humanize(src, { mode: 'full', lang: 'zh' })
  assert.ok(r.text.includes('Redis'), '具体实体被吞了')
})

// ── 扫描 ──────────────────────────────────────────────────────────
test('扫描：等长句被判为平铺', () => {
  const flat = '这是一句话。这是二句话。这是三句话。这是四句话。这是五句话。这是六句话。'
  const r = scan(flat, { lang: 'zh' })
  assert.ok(r.sentences.cv < 0.35, `cv=${r.sentences.cv}`)
  assert.ok(r.structuralPenalty >= 8, `penalty=${r.structuralPenalty}`)
})

test('扫描：长短交错得分更低', () => {
  const flat = '这是一句话。这是二句话。这是三句话。这是四句话。这是五句话。这是六句话。'
  const burst = '短句。这句话稍微长一点，用来把一个具体的意思说清楚，还带个从句。又短。再来一句更长一些的，让节奏不至于整整齐齐。'
  assert.ok(scan(burst, { lang: 'zh' }).score < scan(flat, { lang: 'zh' }).score)
})

test('扫描：语言识别', () => {
  assert.equal(detectLang('这是中文'), 'zh')
  assert.equal(detectLang('this is english'), 'en')
  assert.equal(detectLang('这是一段中文 mixed with english'), 'zh')
})

// ── 声音画像 ──────────────────────────────────────────────────────
test('声音画像：只存数字，能读到句长', () => {
  const sample = '昨晚改了三个小时。先是连接池的问题，后来又发现是缓存键写错了，绕了一大圈才回到原点。就这。'
  const p = profileFromSample(sample, '自测')
  assert.equal(p.label, '自测')
  assert.ok(p.sentenceMean > 0)
  assert.ok(Number.isFinite(p.sentenceCv))
  assert.equal(JSON.stringify(p).includes('连接池'), false, '画像里混进了正文')
})

// ── 提示词层 ──────────────────────────────────────────────────────
test('提示词层：off 返回空，balanced 非空且含开关', () => {
  assert.equal(buildSection({ mode: 'off', lang: 'auto' }), '')
  const s = buildSection({ mode: 'balanced', lang: 'zh' })
  assert.ok(s.includes('去 AI 味'))
  assert.ok(s.includes('deslop_mode'))
  assert.ok(s.length < 6000, `段落太长 ${s.length}`)
})

test('提示词层：带声音画像时输出锚点', () => {
  const s = buildSection({ mode: 'voice-match', lang: 'zh' }, {
    voice: { sentenceMean: 12, sentenceStdev: 7, contractionRate: 0.1, emDashPer1000: 1, colonPer1000: 0.5, openers: ['所以', '然后'] },
  })
  assert.ok(s.includes('声音锚点'))
  assert.ok(s.includes('所以'))
})

// ── 收尾 ──────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const f of failures) console.log(`\n--- ${f.name} ---\n${f.err.stack}`)
  process.exit(1)
}
