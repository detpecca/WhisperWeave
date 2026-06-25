import type { ClassifyGroup, DocType, LLMConfig } from "./types";

const DOC_TYPE_LABEL: Record<DocType, string> = {
  auto: "自动判断",
  daily: "日报",
  weekly: "周报",
  notes: "主题笔记",
  memo: "思考备忘",
};

export function docTypeLabel(t: DocType): string {
  return DOC_TYPE_LABEL[t] ?? "自动判断";
}

/** 构造聚合 prompt。返回 [system, user]。 */
export function buildAggregatePrompt(
  fragments: { content: string; tag?: string }[],
  docType: DocType,
  customInstruction?: string
): { system: string; user: string } {
  const typeHint =
    docType === "daily"
      ? "请整理为一篇「日报」，包含：今日完成、遇到的问题、明日计划。"
      : docType === "weekly"
      ? "请整理为一篇「周报」，包含：本周总结、关键进展、问题与风险、下周计划。"
      : docType === "notes"
      ? "请整理为一篇结构清晰的「主题笔记」，按主题分组，提炼要点与结论。"
      : docType === "memo"
      ? "请整理为一篇「思考备忘录」，梳理思路、给出可执行结论。"
      : "请根据碎片内容自动选择最合适的文档类型（日报/周报/主题笔记/思考备忘）并结构化。";

  const blob = fragments
    .map((f, i) => {
      const tag = f.tag ? `【${f.tag}】 ` : "";
      return `${i + 1}. ${tag}${f.content}`;
    })
    .join("\n");

  const system = [
    "你是 WhisperWeave（絮语织）的写作助手。",
    "你的任务是把用户提供的零碎、口语化的碎片输入，整理成一篇结构化、详细、可直接阅读与分享的 Markdown 文档。",
    "要求：",
    "1. 输出必须是纯 Markdown，不要包裹在代码块里、不要输出多余解释。",
    "2. 先给一个简洁有力的 H1 标题，再给出正文。",
    "3. 自动归类、合并重复内容，按逻辑分节（使用 H2/H3、列表、引用块等）。",
    "4. 保留用户原始的、有价值的事实与观点，去掉无意义的口头禅。",
    "5. 语言与用户输入一致（默认中文）。",
    "6. 如果信息不足以支撑某节，可基于碎片合理推断但不要编造事实。",
  ].join("\n");

  const user = [
    typeHint,
    "",
    "以下是用户的碎片输入：",
    "----",
    blob,
    "----",
    customInstruction ? `\n附加要求：${customInstruction}` : "",
    "",
    "请输出结构化 Markdown 文档。",
  ].join("\n");

  return { system, user };
}

/** LLM 厂商默认配置，用于设置页的模型选择。 */
export const PROVIDER_DEFAULTS: Record<
  string,
  { label: string; model: string; baseUrl?: string }
> = {
  deepseek: {
    label: "DeepSeek",
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
  },
  openai: {
    label: "OpenAI",
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
  },
  anthropic: {
    label: "Anthropic Claude",
    model: "claude-3-5-sonnet-20241022",
  },
  qwen: {
    label: "通义千问",
    model: "qwen-plus",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  zhipu: {
    label: "智谱 GLM",
    model: "glm-4-flash",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
  },
  "openai-compatible": {
    label: "OpenAI 兼容",
    model: "",
    baseUrl: "",
  },
};

export function resolveProviderMeta(cfg: LLMConfig) {
  return (
    PROVIDER_DEFAULTS[cfg.provider] ?? PROVIDER_DEFAULTS["openai-compatible"]
  );
}

/**
 * 构造分类 prompt。返回 [system, user]。
 * 让 LLM 把碎片按主题/标签分组，优先复用已有标签或预设标签，
 * 没有合适的才新建标签（isNewTag 标记，前端可让用户确认）。
 */
export function buildClassifyPrompt(
  fragments: { id: string; content: string; tag?: string }[],
  presetTags: string[]
): { system: string; user: string } {
  const blob = fragments
    .map((f, i) => {
      const t = f.tag ? ` 【标签:${f.tag}】` : "";
      return `${i + 1}. [id:${f.id}]${t} ${f.content}`;
    })
    .join("\n");

  const preset = presetTags.length
    ? `预设标签集合（优先复用）：[${presetTags
        .map((t) => `"${t}"`)
        .join(", ")}]`
    : `预设标签集合：空`;

  const system = [
    "你是 WhisperWeave（絮语织）的碎片分类助手。",
    "任务：把用户的零碎笔记按主题归类分组，以便后续分别织成多篇文档。",
    preset,
    "规则：",
    "1. 同一主题的碎片归为一组；尽量复用碎片已有标签或预设标签。",
    "2. 如果某主题不在预设集合里，你可以新建一个简短标签（2~6 字），并把该组 isNewTag 设为 true。",
    "3. 标签名要简洁、通用，便于检索（如「前端」「读书」「健身」「会议」）。",
    "4. 每条碎片必须恰好归入一组，不能遗漏，不能重复。",
    "5. 如果碎片之间主题差异很大，可以分成多组；若都属同一主题也可以只分一组。",
    "6. 必须输出严格合法的 JSON，且只输出 JSON，不要 markdown 代码块、不要任何解释文字。",
    "7. JSON 结构：{\"groups\":[{\"tag\":string,\"fragmentIds\":string[],\"reason\":string,\"isNewTag\":boolean}]}。",
  ].join("\n");

  const user = [
    "请把以下碎片分类成若干组，输出 JSON：",
    "----",
    blob,
    "----",
  ].join("\n");

  return { system, user };
}

/**
 * 构造「为指定分组织成文档」的 prompt。
 * 与单篇聚合类似，但聚焦于该组主题。
 */
export function buildGroupAggregatePrompt(
  fragments: { content: string; tag?: string }[],
  groupName: string
): { system: string; user: string } {
  const blob = fragments
    .map((f, i) => `${i + 1}. ${f.tag ? `【${f.tag}】 ` : ""}${f.content}`)
    .join("\n");

  const system = [
    "你是 WhisperWeave（絮语织）的写作助手。",
    `现在要把「${groupName}」这一主题下的若干碎片，织成一篇结构化、详细、可直接阅读的 Markdown 文档。`,
    "要求：",
    "1. 输出纯 Markdown，不要包裹代码块、不要多余解释。",
    "2. 先给一个简洁有力的 H1 标题，再给出正文。",
    "3. 按逻辑分节（H2/H3、列表、引用块），合并重复，提炼要点与结论。",
    "4. 保留有价值的事实与观点，去掉口头禅。",
    "5. 语言与用户输入一致（默认中文）。",
    "6. 信息不足的章节可基于碎片合理推断，但不要编造事实。",
  ].join("\n");

  const user = [
    "以下是「" + groupName + "」主题的碎片：",
    "----",
    blob,
    "----",
    "",
    "请输出结构化 Markdown 文档。",
  ].join("\n");

  return { system, user };
}

/** 从原始模型输出里提取 JSON（兼容被 ``` 包裹或前后有杂字的情况）。 */
export function extractJSON<T = unknown>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const first = s.search(/[{[]/);
  const lastBrace = s.lastIndexOf("}");
  const lastBracket = s.lastIndexOf("]");
  const last = Math.max(lastBrace, lastBracket);
  if (first >= 0 && last > first) {
    s = s.slice(first, last + 1);
  }
  return JSON.parse(s) as T;
}

export function normalizeClassifyGroups(raw: unknown): ClassifyGroup[] {
  if (!raw || typeof raw !== "object") return [];
  const groups = (raw as { groups?: unknown }).groups;
  if (!Array.isArray(groups)) return [];
  const out: ClassifyGroup[] = [];
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const tag = String((g as { tag?: unknown }).tag ?? "").trim();
    const ids = (g as { fragmentIds?: unknown }).fragmentIds;
    if (!tag || !Array.isArray(ids)) continue;
    const fragmentIds = ids.map((x) => String(x).trim()).filter(Boolean);
    if (fragmentIds.length === 0) continue;
    out.push({
      tag,
      fragmentIds,
      reason: (g as { reason?: unknown }).reason
        ? String((g as { reason?: unknown }).reason)
        : undefined,
      isNewTag: Boolean((g as { isNewTag?: unknown }).isNewTag),
    });
  }
  return out;
}
