// 真实 SystemPrompt 服务上的集成检查：确认 section 真的进了 assemble 结果。
// 不启动模型、不发网络请求，只组装一次提示词。
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const NM = path.join(HOME, 'profiles', 'node_modules', '@deepseek-ai')
// 状态文件写到临时目录，别碰真实 $DSH_HOME/deslop
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'deslop-assemble-'))
process.env.DSH_HOME = TMP_HOME

async function load(pkg) {
  const p = path.join(NM, pkg, 'lib', 'index.js')
  return import(pathToFileURL(p).href)
}

const { Context } = await load('cordis')
const { default: SystemPrompt } = await load('dsh-system-prompt')
const { apply } = await import('../lib/index.js')

const ctx = new Context()
ctx.plugin(SystemPrompt, { includeHarnessIdentity: true, personaPrefix: '', personaSuffix: '' })
ctx.plugin({
  name: 'dsh-speakhumantalk-probe',
  inject: ['systemPrompt'],
  apply(c) { apply(c, { mode: 'balanced', promptStyle: 'compact', installSkills: false }) },
})

await new Promise((r) => setTimeout(r, 300))

const asm = await ctx.systemPrompt.assemble()
const names = asm.sections.map((s) => s.name)
const ours = asm.sections.find((s) => s.name === 'dsh-speakhumantalk')

if (!ours) {
  console.log('FAIL: dsh-speakhumantalk 段没有进入 assemble；现有段：' + names.join(', '))
  process.exit(1)
}
if (!ours.text.includes('去 AI 味')) {
  console.log('FAIL: 段文本为空')
  process.exit(1)
}

// 切到 off 再组装一次，段必须消失
const { writeState } = await import('../lib/state.js')
writeState({ mode: 'off' })
const asm2 = await ctx.systemPrompt.assemble()
const still = asm2.sections.find((s) => s.name === 'dsh-speakhumantalk')
if (still && still.text.trim()) {
  console.log('FAIL: 关闭后段仍在注入')
  process.exit(1)
}
writeState({ mode: 'balanced' })

const idx = asm.sections.findIndex((s) => s.name === 'dsh-speakhumantalk')
const prev = asm.sections[idx - 1]?.name || '—'
console.log(`assemble ok：${asm.sections.length} 段，dsh-speakhumantalk 排第 ${idx + 1}（前一节 ${prev}），文本 ${ours.text.length} 字符；关闭后段为空`)
fs.rmSync(TMP_HOME, { recursive: true, force: true })
