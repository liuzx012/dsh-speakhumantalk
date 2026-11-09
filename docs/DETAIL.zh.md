# 说人话（dsh-speakhumantalk）

DSH 的去 AI 味插件，每个会话自动生效。

它把四份写作规则和一份对话动态规则压成一层常驻风格层。四份规则指向同一组病灶：套词、谄媚、对冲、三连排比、伪重要性、解释性破折号、段段圆满。差别只在语言和粒度，所以按语言分表、按阶段分管道，而不是四套规则各跑一遍。

## 装完你会多出什么

一个 system prompt 段，落在 persona 之后、结构化输出之前（order 9500），每轮组装时求值。里面是姿态、减法清单、加法清单、边界、开关说明。

四个工具：

- `deslop_scan` —— 评分 0–100，列出命中项，附句长 CV、破折号与加粗密度。只测不改。
- `deslop_rewrite` —— 确定性第一遍清洗。代码块、行内代码、URL、frontmatter 逐字保留，输出前后评分。
- `deslop_mode` —— 查或切强度：`off` / `subtle` / `balanced` / `full` / `voice-match`。
- `deslop_voice` —— 从你自己写的样本抽句长分布、收缩率、破折号密度、开场词，只存数字，不存正文。

四个 skill：

- `deslop` —— 三遍法改稿：杀词、破结构、加人味，收尾 11 项自检。
- `deslop-chat` —— 先定这一轮做哪个社交动作，再定回复形状（几段、多长、要不要问）；处理「别像客服」这类要求。
- `deslop-docs` —— 技术文档：先用 Diátaxis 定类型，再收句子、删模板（Key Features 段、结尾复述、加粗当标题），带 12 项自检与 Vale 接入。
- `deslop-report` —— 中文报告/方案/评估/汇报/docx：先立论证链（口径统一、因果不跳步、分项守恒），再做纵向/横向/标准三类对比并给判断，最后用专业口吻收干净。

## 怎么用

正常聊天就行。要控档说人话：「关掉去AI味」「狠一点」「收敛点」。改别人的稿：先 `deslop_rewrite` 拿到第一遍清洗稿，再按 `deslop` 的三遍法手工重构，最后 `deslop_scan` 复核分数。

## 边界

代码、commit、配置、表格数据不套风格层；安全警告、CVE 复现步骤、法律医疗财务表述按平实准确写法处理，风格让位。事实、数字、引文不动——改写可能让一个记错的数字读起来更自信，改完自己核一遍。

## 上游

unslop、humanize-ai-writing、humanize-writing-skill、natural-talk、Rafiq Human Conversation Dynamics。英文侧用 unslop 的词表与强度分档，中文侧用 natural-talk 的 15 条，结构层用 humanize-writing-skill 的三遍法，行为层用 Rafiq 的 move/shape 规划。
