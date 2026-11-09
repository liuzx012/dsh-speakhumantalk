// 插件状态：模式、语言、声音画像的位置。全部落在 $DSH_HOME/deslop/。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const MODES = ['off', 'subtle', 'balanced', 'full', 'voice-match']
export const DEFAULT_STATE = { mode: 'balanced', lang: 'auto', updatedAt: 0 }

export function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

export function dataDir(home = dshHome()) {
  return path.join(home, 'deslop')
}

export function statePath(home = dshHome()) {
  return path.join(dataDir(home), 'state.json')
}

export function voicePath(home = dshHome()) {
  return path.join(dataDir(home), 'voice.json')
}

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }) } catch { /* 只读宿主忽略 */ }
}

export function readState(home = dshHome()) {
  try {
    const raw = fs.readFileSync(statePath(home), 'utf8')
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_STATE, ...parsed, mode: normalizeMode(parsed.mode) }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function normalizeMode(mode) {
  const m = String(mode || '').toLowerCase().trim()
  if (m === 'normal' || m === 'robotic' || m === '关闭' || m === '停止') return 'off'
  return MODES.includes(m) ? m : 'balanced'
}

export function writeState(patch, home = dshHome()) {
  const next = { ...readState(home), ...patch, updatedAt: Date.now() }
  next.mode = normalizeMode(next.mode)
  ensureDir(dataDir(home))
  const tmp = statePath(home) + '.tmp'
  try {
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8')
    fs.renameSync(tmp, statePath(home))
  } catch {
    try { fs.writeFileSync(statePath(home), JSON.stringify(next, null, 2), 'utf8') } catch { /* ignore */ }
  }
  return next
}

export function readVoice(home = dshHome()) {
  try {
    return JSON.parse(fs.readFileSync(voicePath(home), 'utf8'))
  } catch {
    return null
  }
}

export function writeVoice(profile, home = dshHome()) {
  ensureDir(dataDir(home))
  try {
    fs.writeFileSync(voicePath(home), JSON.stringify(profile, null, 2), 'utf8')
    return true
  } catch {
    return false
  }
}

export function clearVoice(home = dshHome()) {
  try { fs.rmSync(voicePath(home), { force: true }); return true } catch { return false }
}
