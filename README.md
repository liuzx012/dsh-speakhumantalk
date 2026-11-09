# dsh-speakhumantalk

DSH 的说人话插件，每个会话自动生效。把五份上游规则合成一层常驻风格层，外加一个能跑的确定性改写器和两个 skill。

## 它做什么

三块，各管一件事。

常驻风格层：注册一个 system prompt 段（order 9500，落在 persona 之后、结构化输出之前），每轮组装时求值。里面是姿态（先定做什么）、减法清单（词与句式）、加法清单（句长、具体度、表态）、边界（安全警告、代码、法律医疗文本让位）、开关说明。

工具：

| 工具 | 作用 |
|---|---|
| `deslop_scan` | 评分 0–100 + 命中项 + 句长 CV + 破折号/加粗密度。只测不改 |
| `deslop_rewrite` | 确定性第一遍清洗。代码块/URL/行内代码/frontmatter 逐字保留，输出前后评分 |
| `deslop_mode` | 查/切强度（off / subtle / balanced / full / voice-match）与语言 |
| `deslop_voice` | 从用户样本抽句长分布、收缩率、破折号密度、开场词，只存数字 |

skill：`deslop`（三遍法改稿 + 14 项自检）、`deslop-chat`（对话动作与回复形状规划）、`deslop-docs`（技术文档：Diátaxis 定类型、句法收敛、文档体裁的 AI 味清单、Vale 接入）、`deslop-report`（中文报告/方案/评估/docx：论证链、多口径对比、书面语标准、报告体裁 AI 味清单）。插件启动时同步到 `$DSH_HOME/skills/`，内容相同就跳过。

## 装法

给其他 DSH 装，用 tgz 最省事（`dsh plugin add` 会自动登记 bundle）：

```powershell
dsh plugin --profile web add "file:C:/path/dsh-speakhumantalk-1.1.0.tgz"
dsh --profile web --dump-config | Select-String speakhumantalk   # 能看到 # == dsh-speakhumantalk 就对了
```

开发态用解压目录：`dsh plugin --profile web add "link:C:/path/dsh-speakhumantalk"`。

desktop profile 被 Electron 独占，`dsh plugin` 会拒；手工改 `package.json` + 建 junction 的步骤写在 [INSTALL.md](./INSTALL.md)。装完都要重启。

## 用法

正常聊天，风格层自己生效。要控档：

- 「关掉去AI味 / 正常模式」→ 调 `deslop_mode mode=off`，段文本变空，下一轮组装即失效
- 「狠一点」→ `full`；「收敛点」→ `subtle`
- 改别人的稿：先 `deslop_rewrite`，再手工重构，最后 `deslop_scan` 复核

状态文件 `$DSH_HOME/deslop/state.json`，声音画像 `$DSH_HOME/deslop/voice.json`。

## 配置（cordis.patch.yml）

| 键 | 默认 | 说明 |
|---|---|---|
| `alwaysOn` | `true` | 每会话自动注入风格层。设 `false` 只保留工具，不注入 |
| `mode` | `balanced` | 初始强度；写进 state.json 后以文件为准 |
| `lang` | `auto` | 规则语言；auto 按文本 CJK 比例判断 |
| `promptStyle` | `compact` | `full` 注入完整清单，`compact` 约 40 行 |
| `sectionOrder` | `9500` | 段位置。必须靠后，否则压不住前面的格式化习惯 |
| `installSkills` | `true` | 同步 skill 到 `$DSH_HOME/skills` |
| `structural` | `true` | 破折号配额、过渡词去重 |
| `emDashCap` | `2` | 每段破折号上限（纯列表按条计） |
| `touchCode` | `false` | 保留位：改写是否触碰代码区，当前实现恒为逐字保留 |

## 上游与取舍

| 来源 | 拿走了什么 | 丢掉了什么 |
|---|---|---|
| unslop | 英文减法表、五档强度、auto-clarity、保护层思路、burstiness 目标 | Python 实现、detector/watermark 相关论述 |
| humanize-ai-writing | 40 词黑名单、伪重要性、翻译腔、artifact 清理 | 长文模板 |
| humanize-writing-skill | 三遍法、结构病灶清单、14 项自检、声音分档 | LinkedIn 专章 |
| natural-talk | 中文 15 条、D 层对话姿态、防误杀白名单 | 小说 fiction 细则（留在 sources 里） |
| Rafiq Human Conversation Dynamics | move / shape 两层规划、安全分级 | TypeScript 引擎与关系校准状态机 |

没搬的部分留在 `../sources/`，需要时再取。

## 边界

- 代码、commit、配置、表格数据不套风格层。
- 事实、数字、引文不动。改写可能让一个记错的数字读起来更自信，改完自己核一遍。
- 改写器是确定性正则，只做减法。语义重构靠 `deslop` skill 的三遍法，别指望一条正则替你写文章。

## 自检

```powershell
node test/run.mjs               # 引擎：保护层、中英改写、扫描、画像、提示词
node test/plugin-smoke.mjs      # 插件面：section + 4 工具 + skills 落地 + 状态
node test/integration-assemble.mjs  # 真 SystemPrompt 服务上组装一次，确认段真进去了
```
