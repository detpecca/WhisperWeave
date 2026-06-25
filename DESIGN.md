---
name: WhisperWeave
description: 絮语织——把碎片织成文档的安静织机
colors:
  ochre: "#b45309"
  ochre-deep: "#92400e"
  ochre-tint: "#f5e3c7"
  coral-soft: "#ebcece"
  ivory-paper: "#f5f3ef"
  ivory-light: "#faf9f5"
  ivory-medium: "#f0eee6"
  ivory-dark: "#e8e6dc"
  cloud-light: "#d1cfc5"
  cloud-medium: "#b0aea5"
  cloud-dark: "#87867f"
  slate-light: "#5e5d59"
  slate-medium: "#3d3d3a"
  slate-dark: "#141413"
  slate-near-black: "#080808"
typography:
  display:
    fontFamily: "Newsreader, Anthropic Serif, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.7rem"
  body:
    fontFamily: "Switzer, ui-sans-serif, system-ui, -apple-system, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.2rem"
  label:
    fontFamily: "Switzer, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: "1rem"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.85em"
    fontWeight: 400
rounded:
  pill: "100vw"
  small: "4px"
  default: "8px"
  card: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ochre}"
    textColor: "{colors.ivory-light}"
    rounded: "{rounded.default}"
    padding: "7px 14px"
  button-primary-hover:
    backgroundColor: "{colors.ochre-deep}"
  button-primary-disabled:
    backgroundColor: "{colors.cloud-light}"
    textColor: "{colors.ivory-light}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.slate-medium}"
    rounded: "{rounded.default}"
    padding: "7px 14px"
  button-ghost-hover:
    backgroundColor: "{colors.ivory-medium}"
    textColor: "{colors.slate-dark}"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.slate-dark}"
    rounded: "{rounded.default}"
    padding: "8px 11px"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.card}"
    padding: "16px"
  pill:
    backgroundColor: "{colors.ivory-medium}"
    textColor: "{colors.slate-light}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
---

# Design System: WhisperWeave

## 1. Overview

**Creative North Star: "The Loom"**

WhisperWeave 是一台安静的织机。碎片是散落的线头，文档是织成的布，而界面是那台机器本身——它不该比布更惹眼。整个系统围绕一个动作组织：把零碎的输入织成结构化的成文。一切视觉决策都从这个单一动作派生。

气质上利落、克制、有秩序感。留白承担分隔职责，边框只出现在少数不可省的接缝处。色阶节制，唯一的彩色信号是赭石，且刻意稀少——它的稀缺正是它说话的分量。密度偏低但不空旷，让人愿意停留而非焦虑。参考 Linear 的利落与 Notion 的安静，但要更轻、更专注单一任务，拒绝把功能摊成一屏。

这个系统明确拒绝：拥挤的仪表盘式界面（一屏塞满图表、徽章、通知，让人焦虑）；AI slop 视觉（紫色青色霓虹渐变、发光描边、厚单边色块、渐变标题字——AI 生成 UI 的廉价 tell）；以及过度装饰的「创意工具」外壳（拟物纸张、手写字体、繁复插画，盖过内容本身）。

**Key Characteristics:**
- 纸面底色分层，而非描边分隔
- 单一赭石强调色，稀有即分量
- 衬线标题 + 无衬线 UI 的双字体体系
- 六级字号、三档圆角的克制尺度
- 卡片退到背景，内容是主角

## 2. Colors: The Loom Palette

调色板是温调的纸 + 一抹赭石。赭石是唯一的彩色信号，刻意稀少。

### Primary
- **Ochre 藏赭** (#b45309)：唯一强调色。主按钮、聚焦描边、链接、选中态。刻意稀少——它的稀缺就是它说话的分量。
- **Ochre-Deep 深赭** (#92400e)：主按钮 hover / 按下。更沉、更工具感。

### Secondary
- **Ochre-Tint 赭黄** (#f5e3c7)：新标签、待确认提示的软底。赭石的极淡变体，不抢戏。
- **Coral-Soft 柔珊** (#ebcece)：极少用，错误/警示的软底。

### Neutral
- **Ivory-Paper 象纸** (#f5f3ef)：主区域底色。纸面，承载内容。
- **Ivory-Light 浅象纸** (#faf9f5)：侧边栏底色。比主区略亮，分层而非分隔。
- **Ivory-Medium 中象纸** (#f0eee6)：次要表面、pill 标签底、代码内联底。
- **Ivory-Dark 深象纸** (#e8e6dc)：仅用于不可省的接缝描边（侧边栏右沿、编辑器分隔线）。能用背景分层就不用它。
- **Cloud-Light / Medium / Dark** (#d1cfc5 / #b0aea5 / #87867f)：次要文字、占位符、滚动条。三级灰，从浅到深递进。
- **Slate-Light / Medium / Dark** (#5e5d59 / #3d3d3a / #141413)：正文与标题文字。Slate-Dark 是正文近黑，不用纯黑。
- **Slate-Near-Black** (#080808)：代码块底色。仅此一处。

### Named Rules
**The One Thread Rule.** 赭石是唯一的彩色信号。任何一屏上赭石的总面积不超过 10%。它的稀缺是设计意图，不是限制。

**The No-Stripe Rule.** 禁止用 `border-left: >1px` 的彩色竖条做卡片/引用的强调（这是 AI slop 的典型 tell）。强调改用整块底色（赭石按钮）或 1px 描边，绝不堆厚边。

## 3. Typography

**Display Font:** Newsreader（Anthropic Serif 的免费近似，fallback Georgia）
**Body Font:** Switzer（fallback system-ui、PingFang SC、Microsoft YaHei）
**Label/Mono Font:** Switzer（label）；ui-monospace / SFMono-Regular（代码）

**Character:** 衬线标题承担「文气」与可读性，无衬线 UI 承担「工具感」与紧凑。两者在一根对比轴上分工：标题是人，UI 是机器。代码用等宽，独立于两套体系。

### Hierarchy
- **Display** (Newsreader, 600, 20px / 1.7rem)：文档标题输入、页面主标题。衬线，承担文气。
- **Headline** (Newsreader, 600, 16px / 1.5rem)：区块标题（「碎片」「已织文档」「分类预览」）。
- **Title** (Newsreader, 600, 13px / 1.2rem)：卡片内小标题、弹窗标题。
- **Body** (Switzer, 400, 13px / 1.2rem)：碎片内容、列表项、说明文字。行宽不超 75ch。
- **Label** (Switzer, 500, 11px / 1rem)：pill 标签、次要时间戳、辅助提示。可用 uppercase + tracking-wide 做节标题。

### Named Rules
**The Two-Voice Rule.** 衬线只用于标题与文档正文；一切交互文字（按钮、标签、输入、列表项）用无衬线。两套字体在一根对比轴上分工，不混用同族近似字。

**The Scale Discipline Rule.** 字号只用六级（11/12/13/14/16/20）。不引入中间值。尺度越克制，层次越清晰。

## 4. Elevation

默认是平的。深度靠纸面色阶分层传达（侧边栏浅、主区中、卡片白），而非阴影堆叠。阴影只在状态响应时出现：卡片默认近乎无影，hover 时轻浮起，聚焦时用赭石描边光环而非阴影。

### Shadow Vocabulary
- **Resting** (`box-shadow: 0 1px 3px rgba(0,0,0,0.04)`)：卡片默认。几乎看不见，仅暗示边界。
- **Hover** (`box-shadow: 0 4px 12px rgba(0,0,0,0.08)` + `translateY(-1px)`)：可交互卡片悬停。轻浮起，不夸张。
- **Focus Ring** (`box-shadow: 0 0 0 3px rgba(180,83,9,0.14)` + 1px ochre border)：输入聚焦。赭石光环，不用纯蓝。

### Named Rules
**The Flat-By-Default Rule.** 表面默认是平的。阴影只作为状态响应出现（hover、聚焦），从不用于装饰或「让卡片看起来更精致」。

## 5. Components

核心组件整体利落可用：边界清晰、反馈明确，但不堆装饰。退到背景里，让内容说话。

### Buttons
- **Shape:** 8px 圆角（{rounded.default}），紧凑内边距 7px 14px。
- **Primary:** Ochre 底 + Ivory-Light 字。带 14px 线性图标（stroke 1.8）。hover 变 Ochre-Deep。按下 translateY(0.5px)。
- **Hover / Focus:** 背景色过渡 0.15s；focus 用 3px ochre 光环。disabled 变 Cloud-Light 底。
- **Ghost:** 透明底 + 1px Ivory-Dark 描边 + Slate-Medium 字。hover 变 Ivory-Medium 底。用于次级动作（设置、返回、新建）。

### Chips / Pills
- **Style:** 全圆（{rounded.pill}），Ivory-Medium 底 + Slate-Light 字，11px。极紧凑。
- **State:** 选中/已选用 Ochre-Tint 底 + Ochre-Deep 字。新标签用同款 + Ochre-Deep 文字。

### Cards / Containers
- **Corner Style:** 12px 圆角（{rounded.card}）。纯白底。
- **Background:** #ffffff，浮在 Ivory-Paper 主区之上。
- **Shadow Strategy:** 见 Elevation。默认 Resting，可交互卡片 Hover 浮起。
- **Border:** 无描边。仅接缝处（侧边栏右沿、编辑器内编辑/预览分隔）用 1px Ivory-Dark。
- **Internal Padding:** 12–16px。

### Inputs / Fields
- **Style:** 1px Ivory-Dark 描边，白底，8px 圆角，13px 字。
- **Focus:** 描边变 Ochre + 3px ochre 光环。不用纯蓝 focus ring。
- **Title Input:** 特殊——20px 衬线，无外框，聚焦时底部出现 1px Ochre 线。强调「这里是标题」。

### Navigation
- **Style:** 顶栏横排，Logo + 标题左、动作按钮右。侧边栏纵向列表项，hover 变 Ivory 底。
- **Typography:** 标题衬线，列表项无衬线 13px。
- **States:** 当前项无高亮（单一任务流，不强调「你在哪」），hover 轻底色。

## 6. Do's and Don'ts

### Do:
- **Do** 用纸面色阶分层（Ivory-Light 侧栏 / Ivory-Paper 主区 / 白卡片），替代描边分隔。
- **Do** 把赭石留给真正需要强调的交互（主按钮、聚焦、链接），一屏赭石面积 ≤10%。
- **Do** 标题用衬线 Newsreader、一切交互文字用 Switzer，两套字体分工不混。
- **Do** 字号只用六级（11/12/13/14/16/20），圆角只用三档（4/8/12px + pill）。
- **Do** 卡片默认近乎无影，hover 才轻浮起；聚焦用赭石光环不用阴影。
- **Do** 留白承担分隔职责，宁可多留也不要堆分隔线。

### Don't:
- **Don't** 用 `border-left: >1px` 的彩色竖条做强调（厚单边色块是 AI slop 的典型 tell，PRODUCT.md 明确反例）。
- **Don't** 用紫色/青色霓虹渐变、发光描边、渐变标题字——AI 生成 UI 的廉价 tell。
- **Don't** 把界面做成仪表盘：一屏塞满图表、徽章、通知。WhisperWeave 是单一任务工具，不是 cockpit。
- **Don't** 用纯黑（#000）做正文，用 Slate-Dark (#141413)；不用纯白做底，用 Ivory 纸面。
- **Don't** 用纯蓝聚焦环，用赭石光环。
- **Don't** 引入第七个字号或第四档圆角——尺度克制是层次清晰的前提。
- **Don't** 用拟物纸张、手写字体、繁复插画装饰——界面是织机，不是布。
