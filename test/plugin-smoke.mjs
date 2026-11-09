// 插件面自检：用假 cordis ctx 跑一遍 apply()，确认 section 与四个工具都真注册上了。
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

// 用临时 DSH_HOME，别污染真的 home
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'deslop-smoke-'))
process.env.DSH_HOME = tmpHome

const { apply } = await import('../lib/index.js')

const sections = []
const tools = new Map()
const logs = []

const ctx = {
  logger: { info: (m) => logs.push(m) },
  systemPrompt: {
    section(spec) {
      sections.push(spec)
      return () => {}
    },
  },
  tools: {
    register(def) {
      assert.ok(def.name, 'tool 必须带 name')
      assert.ok(def.description, `${def.name} 缺 description`)
      assert.equal(def.parameters.type, 'object')
      tools.set(def.name, def)
    },
  },
  effect(fn) { fn() },
}

apply(ctx, { mode: 'balanced', promptStyle: 'compact', installSkills: true })

assert.equal(sections.length, 1, '必须注册且只注册一个 section')
const section = sections[0]
assert.equal(section.name, 'dsh-speakhumantalk')
assert.ok(section.order > 5000, '段位置必须靠后，才压得住前面的格式化习惯')
const text = section.text({})
assert.ok(text.includes('去 AI 味'), '段内容为空')
assert.ok(text.includes('deslop_mode'), '段里没给模式开关')

assert.deepEqual([...tools.keys()].sort(), ['deslop_mode', 'deslop_rewrite', 'deslop_scan', 'deslop_voice'])

// 工具真的能跑
const scanOut = await tools.get('deslop_scan').execute({ text: '首先，值得注意的是，这不是一次普通的更新，而是范式转移。' })
assert.ok(scanOut.text.includes('AI 味评分'), scanOut.text)

const rewriteOut = await tools.get('deslop_rewrite').execute({ text: '好问题！说白了，这个方案很好。', mode: 'balanced' })
assert.ok(rewriteOut.text.includes('改写稿'), rewriteOut.text)
const rewritten = rewriteOut.text.split('--- 改写稿 ---')[1] || ''
assert.equal(rewritten.includes('好问题'), false, '客服腔没删')
assert.equal(rewritten.includes('说白了'), false, '引导词没删')

const modeOut = await tools.get('deslop_mode').execute({ mode: 'subtle' })
assert.ok(modeOut.text.includes('subtle'), modeOut.text)
const stateFile = path.join(tmpHome, 'deslop', 'state.json')
assert.ok(fs.existsSync(stateFile), 'state.json 没落盘')
assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).mode, 'subtle')

// 切到 off 后 section 必须变空
const offOut = await tools.get('deslop_mode').execute({ mode: 'off' })
assert.ok(offOut.text.includes('已关闭'), offOut.text)
assert.equal(section.text({}), '', 'off 状态下仍在注入')

// skills 是否落地
assert.ok(fs.existsSync(path.join(tmpHome, 'skills', 'deslop', 'SKILL.md')), 'deslop skill 没落地')
assert.ok(fs.existsSync(path.join(tmpHome, 'skills', 'deslop-chat', 'SKILL.md')), 'deslop-chat skill 没落地')

const voiceOut = await tools.get('deslop_voice').execute({
  action: 'sample',
  label: 'smoke',
  sample: '昨晚改了三小时。先是连接池，后来又发现缓存键写错了，绕一圈回到原点。就这。',
})
assert.ok(voiceOut.text.includes('声音画像'), voiceOut.text)
assert.ok(fs.existsSync(path.join(tmpHome, 'deslop', 'voice.json')), 'voice.json 没落盘')

fs.rmSync(tmpHome, { recursive: true, force: true })
console.log('plugin smoke ok：section + 4 tools + skills 落地 + 状态持久化')
