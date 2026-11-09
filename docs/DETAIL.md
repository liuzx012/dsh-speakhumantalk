# Speak Human Talk (dsh-speakhumantalk)

An always-on de-slop plugin for DSH: every session gets the style layer without asking.

It merges four writing-rule projects and one conversation-dynamics project into a single resident layer. All four describe the same defects — stock phrases, sycophancy, hedges, rule-of-three parallelism, fake significance, explanatory em dashes, paragraphs that always land neatly. They differ only in language and granularity, so the rules are split by language and staged into passes instead of run four times.

## What you get

A system prompt section, ordered at 9500, right after the persona and before structured output. It is re-evaluated on every assembly: stance, subtraction list, addition list, boundaries, controls.

Four tools:

- `deslop_scan` — score 0–100, hit list, sentence-length CV, em-dash and bold density. Measures, never rewrites.
- `deslop_rewrite` — deterministic first pass. Code fences, inline code, URLs and frontmatter are preserved byte for byte; before/after scores included.
- `deslop_mode` — inspect or switch intensity: `off` / `subtle` / `balanced` / `full` / `voice-match`.
- `deslop_voice` — statistics from your own writing samples: sentence lengths, contraction rate, em-dash density, openers. Numbers only, never the prose.

Four skills:

- `deslop` — three-pass rewrite: kill words, break structure, add a human, then an 11-item checklist.
- `deslop-chat` — pick the social move for the turn first, then the reply shape; for "stop sounding like support".
- `deslop-docs` — technical docs: pick the Diátaxis type first, then tighten sentences and strip template bloat, with a 12-item checklist and Vale setup.
- `deslop-report` — Chinese reports, proposals, assessments, docx: build the argument chain first (fixed scope, no skipped causal step, parts summing to the whole), then longitudinal/lateral/standard comparisons with a verdict, then a professional register.

## Usage

Just talk. To control it, ask in plain words: "turn it off", "harder", "softer". Rewriting someone else's draft: `deslop_rewrite` for the first pass, the `deslop` skill for the structural rebuild, `deslop_scan` to check the score.

## Boundaries

Code, commits, config and tabular data are untouched. Safety warnings, CVE reproduction steps, and legal, medical or financial statements keep a plain, accurate register — the style layer yields. Facts, numbers and quotations do not move: a rewrite can make a misremembered number sound more confident, so verify after.

## Upstream

unslop, humanize-ai-writing, humanize-writing-skill, natural-talk, Rafiq Human Conversation Dynamics.
