// dsh-speakhumantalk —— DSH 说人话插件入口。
// 每个会话自动生效：常驻风格层（全局 systemPrompt 段）+ 确定性改写/检测工具 + 两个 skill。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { humanize, summarize } from './humanize.js'
import { scan, formatScan } from './scan.js'
import { buildSection } from './prompt.js'
import { readState, writeState, readVoice, normalizeMode, dshHome as resolveHome } from './state.js'
import { profileFromSample, saveVoice, removeVoice, formatVoice } from './voice.js'

export const name = 'dsh-speakhumantalk'
export const inject = ['systemPrompt', 'tools']

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_NAMES = ['deslop', 'deslop-chat', 'deslop-docs', 'deslop-report']
const MAX_TEXT = 400_000

function effectiveState(config) {
  const home = resolveHome()
  const state = readState(home)
  if (!state.updatedAt) {
    // 没写过 state.json 时，配置层就是默认值
    return {
      ...state,
      mode: normalizeMode(config?.mode || 'balanced'),
      lang: config?.lang || 'auto',
      from: 'config',
    }
  }
  return { ...state, from: 'state.json' }
}

function statusLine(state, voice) {
  return `去 AI 味：${state.mode === 'off' ? '已关闭' : `开启（${state.mode}）`}｜语言 ${state.lang}｜声音画像 ${voice ? '已建立' : '未建立'}`
}

/** 把随包 skill 同步到 $DSH_HOME/skills/<name>/SKILL.md（内容相同就跳过） */
function installSkills(log) {
  const home = resolveHome()
  const targetRoot = path.join(home, 'skills')
  const done = []
  for (const skill of SKILL_NAMES) {
    const src = path.join(PACKAGE_ROOT, 'skills', skill, 'SKILL.md')
    if (!fs.existsSync(src)) continue
    const dir = path.join(targetRoot, skill)
    const dest = path.join(dir, 'SKILL.md')
    try {
      const body = fs.readFileSync(src, 'utf8')
      let current = null
      try { current = fs.readFileSync(dest, 'utf8') } catch { /* 首次安装 */ }
      if (current === body) { done.push(`${skill}:已是最新`); continue }
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(dest, body, 'utf8')
      done.push(`${skill}:已写入`)
    } catch (err) {
      done.push(`${skill}:失败(${err?.message || err})`)
    }
  }
  if (done.length) log(`skills ${done.join(' / ')}`)
  return done
}

function textOutput() {
  return {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { text: { type: 'string' } },
    },
    render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
  }
}

export function apply(ctx, config = {}) {
  const log = (msg) => {
    try { ctx?.logger?.info?.(`[dsh-speakhumantalk] ${msg}`) } catch { /* 无 logger 的宿主 */ }
  }

  const cfg = {
    enabled: config.enabled !== false,
    // 每会话自动注入。设成 false 只保留工具，不再注入风格层
    alwaysOn: config.alwaysOn !== false,
    promptStyle: config.promptStyle === 'full' ? 'full' : 'compact',
    sectionOrder: Number.isFinite(config.sectionOrder) ? config.sectionOrder : 9500,
    structural: config.structural !== false,
    emDashCap: Number.isFinite(config.emDashCap) ? config.emDashCap : 2,
    installSkills: config.installSkills !== false,
  }

  if (!cfg.enabled) {
    log('disabled by config')
    return
  }

  // ── 1. 常驻风格层 ──────────────────────────────────────────────
  if (cfg.alwaysOn) {
    try {
      const section = {
        name: 'dsh-speakhumantalk',
        order: cfg.sectionOrder,
        interpolate: false,
        text: () => {
          const state = effectiveState(config)
          if (state.mode === 'off') return ''
          return buildSection(state, { style: cfg.promptStyle, voice: readVoice() })
        },
      }
      const dispose = ctx.systemPrompt.section(section)
      if (typeof dispose === 'function' && typeof ctx.effect === 'function') {
        try { ctx.effect(() => dispose) } catch { /* 死 ctx */ }
      }
      log(`prompt section registered at order ${cfg.sectionOrder} (${cfg.promptStyle})`)
    } catch (err) {
      log(`prompt section failed: ${err?.message || err}`)
    }
  } else {
    log('alwaysOn=false，跳过风格层注入，只保留工具')
  }

  // ── 2. 工具 ────────────────────────────────────────────────────
  // cordis 代理在服务未注入时访问属性会抛，必须 try 包住
  let tools = null
  try { tools = ctx.tools } catch { tools = null }

  if (tools) {
    tools.register({
      name: 'deslop_scan',
      description: '给一段文本做 AI 味体检：输出评分（0–100，越高越像 AI）、命中项（套词/套话/翻案腔/翻译腔/伪重要性等）、句长 burstiness、破折号与加粗密度。只测不改，用于改写前后复核。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', description: '待检测文本' },
          lang: { type: 'string', enum: ['auto', 'zh', 'en'], description: '语言，默认 auto' },
        },
        required: ['text'],
      },
      output: textOutput(),
      async execute(args) {
        const text = String(args?.text ?? '').slice(0, MAX_TEXT)
        if (!text.trim()) return { text: 'ERROR: text 为空' }
        const result = scan(text, { lang: args?.lang === 'auto' ? undefined : args?.lang })
        return { text: formatScan(result) }
      },
    })

    tools.register({
      name: 'deslop_rewrite',
      description: '对文本执行确定性第一遍清洗：换掉 AI 套词、删对冲与客服腔、加缩写、破折号配额、过渡词去重；full 档再加翻案腔拆解、去 emoji、去加粗噪音。代码块/行内代码/URL/frontmatter 逐字保留。返回改写稿 + 变更摘要 + 保护区校验。这是第一遍，语义重构仍需二次编辑。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', description: '待改写文本' },
          mode: { type: 'string', enum: ['subtle', 'balanced', 'full'], description: '强度，默认取插件当前档位' },
          lang: { type: 'string', enum: ['auto', 'zh', 'en'], description: '语言，默认 auto' },
          structural: { type: 'boolean', description: '是否做结构处理（破折号配额/过渡去重），默认 true' },
          emDashCap: { type: 'number', description: '每段破折号上限，默认 2' },
        },
        required: ['text'],
      },
      output: textOutput(),
      async execute(args) {
        const text = String(args?.text ?? '').slice(0, MAX_TEXT)
        if (!text.trim()) return { text: 'ERROR: text 为空' }
        const state = effectiveState(config)
        const result = humanize(text, {
          mode: args?.mode || (state.mode === 'off' ? 'balanced' : state.mode),
          lang: args?.lang || state.lang,
          structural: args?.structural !== false && cfg.structural,
          emDashCap: Number.isFinite(args?.emDashCap) ? args.emDashCap : cfg.emDashCap,
          voice: readVoice(),
        })
        return { text: `${summarize(result)}\n\n--- 改写稿 ---\n${result.text}` }
      },
    })

    tools.register({
      name: 'deslop_mode',
      description: '查看或切换去 AI 味的强度与语言。不传参数则返回当前状态。mode=off 表示完全停用（system prompt 不再注入风格层）。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          mode: { type: 'string', enum: ['off', 'subtle', 'balanced', 'full', 'voice-match'], description: '目标强度' },
          lang: { type: 'string', enum: ['auto', 'zh', 'en'], description: '语言偏好' },
        },
      },
      output: textOutput(),
      async execute(args) {
        const home = resolveHome()
        if (!args?.mode && !args?.lang) {
          const state = effectiveState(config)
          return { text: `${statusLine(state, readVoice())}\n来源：${state.from}\n状态文件：${path.join(home, 'deslop', 'state.json')}` }
        }
        const next = writeState({
          ...(args?.mode ? { mode: args.mode } : {}),
          ...(args?.lang ? { lang: args.lang } : {}),
        }, home)
        return {
          text: `已切换：${statusLine(next, readVoice())}\n下一轮组装生效（当前会话可能需要一条新消息后再看效果）。`,
        }
      },
    })

    tools.register({
      name: 'deslop_voice',
      description: '声音画像：从用户自己写的样本里抽统计量（句长分布、收缩率、破折号密度、开场词），只存数字不存正文。用于 voice-match 与风格层里的声音锚点。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', enum: ['show', 'sample', 'clear'], description: 'show 查看；sample 用样本建立画像；clear 删除' },
          sample: { type: 'string', description: 'action=sample 时的样本文本' },
          label: { type: 'string', description: '画像备注名，可选' },
        },
        required: ['action'],
      },
      output: textOutput(),
      async execute(args) {
        const action = args?.action
        if (action === 'clear') {
          const ok = removeVoice()
          return { text: ok ? '声音画像已删除。' : '删除失败（文件可能不存在或不可写）。' }
        }
        if (action === 'sample') {
          const sample = String(args?.sample || '')
          const cjk = (sample.match(/[\u4e00-\u9fff]/g) || []).length
          const words = (sample.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length
          if (cjk + words < 30) {
            return { text: 'ERROR: 样本太短（中文 30 字 / 英文 30 词起），统计会失真。' }
          }
          const profile = profileFromSample(sample, args?.label)
          const ok = saveVoice(profile)
          return { text: `${ok ? '画像已保存。' : '保存失败（只在本轮生效）。'}\n${formatVoice(profile)}` }
        }
        return { text: formatVoice(readVoice()) }
      },
    })

    log('tools registered: deslop_scan / deslop_rewrite / deslop_mode / deslop_voice')
  } else {
    log('tools service not injected, skip tools')
  }

  // ── 3. skills ──────────────────────────────────────────────────
  if (cfg.installSkills) {
    try { installSkills(log) } catch (err) { log(`skills install failed: ${err?.message || err}`) }
  }
}

const plugin = { name, inject, apply }
export default plugin
