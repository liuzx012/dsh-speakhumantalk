// 合并自四个上游的规则数据。所有表都是纯数据，方便 auditable、方便加词。
//   unslop                     英文减法（stock vocab / sycophancy / hedging / 破折号配额）
//   humanize-ai-writing        40 词黑名单、伪重要性、翻译腔、ruled-of-three
//   humanize-writing-skill     三遍法要打掉的结构（平行否定、镜像句、修辞问、dramatic reveal）
//   natural-talk               中文 15 条 + D 层对话姿态 + 防误杀白名单

// ── 英文词表：词 → 替换。null 表示删除整句/整词。
export const EN_STOCK = {
  delve: 'dig',
  tapestry: 'mix',
  testament: 'proof',
  underscore: 'show',
  underscores: 'shows',
  underscored: 'showed',
  pivotal: 'key',
  intricate: 'detailed',
  meticulous: 'careful',
  garner: 'get',
  garnered: 'got',
  vibrant: 'lively',
  bolstered: 'strengthened',
  bolster: 'strengthen',
  enduring: 'lasting',
  interplay: 'interaction',
  crucial: 'key',
  exemplify: 'show',
  exemplifies: 'shows',
  renowned: 'well-known',
  groundbreaking: 'new',
  boasts: 'has',
  nestled: 'sits',
  realm: 'area',
  embark: 'start',
  leverages: 'uses',
  leveraging: 'using',
  leverage: 'use',
  elevate: 'raise',
  elevated: 'raised',
  unlock: 'open',
  unlocks: 'opens',
  unleash: 'release',
  unleashing: 'releasing',
  harness: 'use',
  harnesses: 'uses',
  harnessing: 'using',
  robust: 'solid',
  seamless: 'smooth',
  seamlessly: 'smoothly',
  holistic: 'whole',
  myriad: 'many',
  plethora: 'plenty',
  cornerstone: 'base',
  beacon: 'guide',
  paradigm: 'model',
  synergy: 'teamwork',
  'cutting-edge': 'new',
  'state-of-the-art': 'top-end',
  'world-class': 'very good',
  'best-in-class': 'very good',
  'industry-leading': 'top',
  'game-changing': 'big',
  'next-generation': 'new',
  multifaceted: 'many-sided',
  utilize: 'use',
  utilizes: 'uses',
  utilizing: 'using',
  facilitate: 'help',
  facilitates: 'helps',
  optimize: 'tune',
  navigate: 'work through',
  landscape: 'field',
}

// 整句删除的谄媚开场（句子级，出现在段首/文首才处理）
export const EN_SYCOPHANCY = [
  /^\s*(great|excellent|fantastic|wonderful) question[.!]?\s*/i,
  /^\s*what a (great|fantastic|fascinating) question[.!]?\s*/i,
  /^\s*(certainly|absolutely|sure thing|of course)[.!]?\s*/i,
  /^\s*i'?d be (happy|glad|delighted) to help[.!]?\s*/i,
  /^\s*happy to help[.!]?\s*/i,
  /^\s*that'?s a (great|good|excellent) question[.!]?\s*/i,
  /^\s*(no problem|you'?re welcome)[.!]?\s*/i,
]

// 对冲套话：删掉引导词，保留事实
export const EN_HEDGES = [
  /\bit(?:'s| is) important to note that\s*/gi,
  /\bit should be noted that\s*/gi,
  /\bit(?:'s| is) worth (?:noting|mentioning) that\s*/gi,
  /\bgenerally speaking,\s*/gi,
  /\bin essence,\s*/gi,
  /\bat its core,\s*/gi,
  /\bbroadly speaking,\s*/gi,
  /\bneedless to say,\s*/gi,
]

// 填充短语 → 收紧
export const EN_FILLER = {
  'in order to': 'to',
  'due to the fact that': 'because',
  'at this point in time': 'now',
  'at the present time': 'now',
  'a large number of': 'many',
  'a wide range of': 'many',
  'in the event that': 'if',
  'with regard to': 'about',
  'in terms of': 'for',
  'prior to': 'before',
  'subsequent to': 'after',
  'serves as a testament to': 'shows',
  'serves as': 'is',
  'stands as': 'is',
  'plays a vital role in': 'matters for',
  'plays a crucial role in': 'matters for',
  "in today's world": '',
  'when it comes to': 'for',
  'the fact that': 'that',
  'it is possible that': 'maybe',
  'in the realm of': 'in',
}

// 段落级过渡词：连续出现就删掉多出来的
export const EN_TRANSITIONS = /\b(?:furthermore|moreover|additionally|notably|importantly|in addition)\b,?\s*/gi

// 收缩形式（只在 balanced/full 生效；formal 内容不碰）
export const EN_CONTRACTIONS = [
  [/\bit is\b/g, "it's"],
  [/\bIt is\b/g, "It's"],
  [/\bdo not\b/g, "don't"],
  [/\bDo not\b/g, "Don't"],
  [/\bdoes not\b/g, "doesn't"],
  [/\bdid not\b/g, "didn't"],
  [/\bcannot\b/g, "can't"],
  [/\bwill not\b/g, "won't"],
  [/\bwould not\b/g, "wouldn't"],
  [/\bcould not\b/g, "couldn't"],
  [/\bshould not\b/g, "shouldn't"],
  [/\bis not\b/g, "isn't"],
  [/\bare not\b/g, "aren't"],
  [/\bwas not\b/g, "wasn't"],
  [/\bwere not\b/g, "weren't"],
  [/\bhave not\b/g, "haven't"],
  [/\bhas not\b/g, "hasn't"],
  [/\bhad not\b/g, "hadn't"],
  [/\bI am\b/g, "I'm"],
  [/\byou are\b/g, "you're"],
  [/\bYou are\b/g, "You're"],
  [/\bthey are\b/g, "they're"],
  [/\bwe are\b/g, "we're"],
  [/\bthat is\b/g, "that's"],
  [/\bthere is\b/g, "there's"],
  [/\blet us\b/g, "let's"],
]

// ── 中文：机械引导词（句首，删掉引导保留后半句）
export const ZH_OPENERS = [
  /(?:^|[。！？\n])\s*(?:说白了|说穿了|简单来说|简单说|说白了|先说结论|说到底|归根结底|总的来说|总体而言|综上所述|由此可见|直接给答案|一句话总结)\s*[，,：:]\s*/g,
  /(?:^|[。！？\n])\s*(?:值得注意的是|需要指出的是|不得不说|客观来讲|坦白说|严格来说)\s*[，,：:]\s*/g,
]

// 客服腔：整段删除
export const ZH_SERVICE = [
  /好问题[!！。]?\s*/g,
  /(?:感谢|谢谢)(?:你的)?提问[!！。]?\s*/g,
  /希望(?:这)?对你有(?:所)?帮助[!！。]?\s*/g,
  /欢迎(?:随时)?提问[!！。]?\s*/g,
  /如有(?:其他|任何)问题[^。！？\n]{0,20}[。！？]?\s*/g,
  /作为一个(?:AI|人工智能)?(?:语言模型|助手)[，,]\s*/g,
  /根据我的训练数据[，,]\s*/g,
  /我的知识截止(?:日期)?[^。！？\n]{0,10}[。！？]?\s*/g,
  /我(?:目前)?无法访问(?:实时|互联网)[^。！？\n]{0,10}[。！？]?\s*/g,
]

// 空泛对冲：直接删
export const ZH_HEDGE = [
  /从某种程度上(?:来说|来讲|讲|说)?[，,]\s*/g,
  /在某种意义上(?:来说|来讲|讲|说)?[，,]\s*/g,
  /不得不说[，,]\s*/g,
  /众所周知[，,]\s*/g,
  /(?:其实|事实上|实际上)[，,]\s*/g,
]

// 宏观开场：只剥壳，保留后面可能的具体信息
export const ZH_MACRO = [
  /(?:^|[。！？\n])在当今[^，。！？\n]{0,12}(?:时代|社会|背景|环境下)?[，,]\s*/g,
  /(?:^|[。！？\n])随着[^，。！？\n]{0,24}的不断发展[，,]\s*/g,
  /(?:^|[。！？\n])在[^，。！？\n]{0,8}的今天[，,]\s*/g,
]

// 冒号提示壳
export const ZH_COLON_SHELL = /(?:^|[。！？\n])\s*(?:原因如下|核心是|本质上|关键在于|结果|结论|直接说)\s*[：:]\s*/g

// 只报不改：需要语义判断
export const REPORT_ONLY = {
  zh: [
    { id: 'zh-attribution', label: '模糊归因', re: /(?:有研究表明|研究显示|业内(?:普遍)?认为|专家(?:指出|认为)|不少用户反馈|据(?:了解|悉))/g },
    { id: 'zh-echo', label: '「这意味着/这表明」机械复述', re: /(?:这意味着|这表明|这说明了)/g },
    { id: 'zh-translate', label: '翻译腔结构', re: /(?:对于[^，。]{1,12}来说|当[^，。]{1,30}时[，,])/g },
    { id: 'zh-metaphor', label: '装饰性喻体', re: /(?:像|如同|宛如|好比)[^，。！？\n]{0,10}(?:导师|猎手|灯塔|引擎|钟表|交响|卫士|摆渡人|溺水者|小兽|一潭死水)/g },
    { id: 'zh-ordinal', label: '序数词小标题', re: /^(?:#{1,6}\s*)?(?:一、|二、|三、|第一[、，,]|第二[、，,]|第三[、，,])/gm },
    { id: 'zh-emph', label: '拔高升华', re: /(?:这不仅是[^。！？\n]{0,30}更是|不仅是[^。！？\n]{0,20}更是)/g },
  ],
  en: [
    { id: 'en-fake-significance', label: '伪重要性', re: /\b(?:stands as|serves as a testament|marks a pivotal moment|leaves an indelible mark|setting the stage for|turning point|evolving landscape|focal point|deeply rooted|reflects a broader)\b/gi },
    { id: 'en-negative-parallel', label: '否定义平行（not just X but Y）', re: /\b(?:not just|not only|more than just)\b[^.!?\n]{0,60}\bbut\b/gi },
    { id: 'en-rhetorical', label: '修辞问 + 自答', re: /[^.!?\n]{0,40}\?\s*(?:It means|The answer is|Here'?s)/g },
    { id: 'en-reveal', label: '戏剧化揭晓（Here is the thing）', re: /\b(?:here'?s the thing|the result\?|the catch\?|plot twist)\b/gi },
    { id: 'en-participle', label: '句末 -ing 尾巴', re: /,\s*(?:highlighting|emphasizing|reflecting|underscoring|showcasing|illustrating)\b[^.!?\n]*/gi },
    { id: 'en-copula', label: '回避系动词', re: /\b(?:boasts|features|maintains|offers up)\b/gi },
    { id: 'en-artifact', label: '工具残留（contentReference 等）', re: /(?:contentReference|oaicite|oai_citation|turn0search0|utm_source=)/g },
  ],
}

// 保护白名单（防误杀）：命中这些形态的句子不改
export const WHITELIST_HINTS = [
  /[A-Za-z]:\\/, // 路径
  /\b(?:npm|pnpm|git|docker|kubectl|curl|ssh|nmap)\b/, // 命令
  /\d+(?:\.\d+)?%/, // 数据
]

// 中文句子切分（供 burstiness 统计）
export const SENTENCE_SPLIT = /(?<=[。！？!?；;])|\n+/
