import type {
  AggregateRequest,
  AggregateResponse,
  ClassifyRequest,
  ClassifyResponse,
  LLMConfig,
} from "./types";
import {
  buildAggregatePrompt,
  buildClassifyPrompt,
  buildGroupAggregatePrompt,
  extractJSON,
  normalizeClassifyGroups,
} from "./prompt";

/**
 * 统一的聚合调用：根据 provider 适配不同厂商，
 * 最终返回结构化 markdown 文档。
 * 运行在服务端（API Route），API key 不进入浏览器。
 */
export async function aggregateWithLLM(
  req: AggregateRequest
): Promise<AggregateResponse> {
  const { system, user } = buildAggregatePrompt(
    req.fragments,
    req.docType ?? "auto",
    req.customInstruction
  );
  return runAggregate(req.config, system, user);
}

/** 为单个分类分组组织文档。 */
export async function aggregateGroupWithLLM(
  cfg: LLMConfig,
  groupName: string,
  fragments: { content: string; tag?: string }[],
  _sourceIds: string[]
): Promise<AggregateResponse> {
  const { system, user } = buildGroupAggregatePrompt(fragments, groupName);
  return runAggregate(cfg, system, user);
}

/** 内部：真正的模型调用与结果拆分。 */
async function runAggregate(
  cfg: LLMConfig,
  system: string,
  user: string
): Promise<AggregateResponse> {
  const start = Date.now();
  const raw = await callLLM(cfg, system, user);
  const cleaned = stripCodeFence(raw);
  const { title, markdown } = splitTitle(cleaned);
  return {
    title,
    markdown,
    provider: cfg.provider,
    model: cfg.model,
    elapsed: Date.now() - start,
  };
}

/** 分类：让 LLM 把碎片按主题分组。 */
export async function classifyFragments(
  req: ClassifyRequest
): Promise<ClassifyResponse> {
  const { system, user } = buildClassifyPrompt(req.fragments, req.presetTags);
  const start = Date.now();
  const raw = await callLLM(req.config, system, user);
  let groups = normalizeClassifyGroups(extractJSON(raw));
  // 补偿：若模型没按 isNewTag 标记，前端依赖此字段，这里兜底标记
  const presetSet = new Set(req.presetTags);
  const existingTags = new Set(
    req.fragments.map((f) => f.tag).filter(Boolean) as string[]
  );
  groups = groups.map((g) => ({
    ...g,
    isNewTag:
      !presetSet.has(g.tag) && !existingTags.has(g.tag) ? true : g.isNewTag,
  }));
  if (groups.length === 0) {
    throw new Error("分类失败：模型未返回有效分组，请检查模型是否支持 JSON 输出");
  }
  return {
    groups,
    provider: req.config.provider,
    model: req.config.model,
    elapsed: Date.now() - start,
  };
}

/** 调用各厂商 Chat Completions / Messages 接口，统一返回纯文本。 */
async function callLLM(cfg: LLMConfig, system: string, user: string): Promise<string> {
  switch (cfg.provider) {
    case "anthropic":
      return callAnthropic(cfg, system, user);
    case "openai":
    case "deepseek":
    case "qwen":
    case "zhipu":
    case "openai-compatible":
    default:
      return callOpenAICompatible(cfg, system, user);
  }
}

function envFallback(cfg: LLMConfig): { apiKey: string; baseUrl: string; model: string } {
  const baseByProvider: Record<string, string | undefined> = {
    openai: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    deepseek: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    qwen: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    zhipu: process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
    "openai-compatible": process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    anthropic: "",
  };
  const keyByProvider: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    qwen: process.env.QWEN_API_KEY,
    zhipu: process.env.ZHIPU_API_KEY,
    "openai-compatible": process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  };
  const modelByProvider: Record<string, string | undefined> = {
    openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
    deepseek: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    qwen: process.env.QWEN_MODEL || "qwen-plus",
    zhipu: process.env.ZHIPU_MODEL || "glm-4-flash",
    "openai-compatible": process.env.OPENAI_MODEL,
    anthropic: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
  };
  return {
    apiKey: cfg.apiKey || keyByProvider[cfg.provider] || "",
    baseUrl: cfg.baseUrl || baseByProvider[cfg.provider] || "",
    model: cfg.model || modelByProvider[cfg.provider] || "",
  };
}

async function callOpenAICompatible(
  cfg: LLMConfig,
  system: string,
  user: string
): Promise<string> {
  const { apiKey, baseUrl, model } = envFallback(cfg);
  if (!apiKey) throw new Error(`未配置 ${cfg.provider} 的 API Key（设置页或 .env）`);
  if (!baseUrl) throw new Error(`未配置 ${cfg.provider} 的 Base URL`);
  if (!model) throw new Error(`未配置 ${cfg.provider} 的 模型名`);

  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
      stream: false,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await safeText(res);
    throw new Error(`LLM 请求失败 (${res.status}): ${detail.slice(0, 500)}`);
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("LLM 返回内容为空");
  return content;
}

async function callAnthropic(
  cfg: LLMConfig,
  system: string,
  user: string
): Promise<string> {
  const { apiKey, model } = envFallback(cfg);
  if (!apiKey) throw new Error("未配置 Anthropic API Key");
  if (!model) throw new Error("未配置 Anthropic 模型名");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await safeText(res);
    throw new Error(`Claude 请求失败 (${res.status}): ${detail.slice(0, 500)}`);
  }
  const data = await res.json();
  const content: string = data?.content?.[0]?.text ?? "";
  if (!content) throw new Error("Claude 返回内容为空");
  return content;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

/** 去掉模型有时会包裹的 ```markdown ... ``` */
function stripCodeFence(s: string): string {
  let t = s.trim();
  const fence = /^```(?:markdown|md)?\s*\n/i;
  if (fence.test(t)) {
    t = t.replace(fence, "");
    if (t.endsWith("```")) t = t.slice(0, -3);
  }
  return t.trim();
}

/** 从 markdown 中拆出 H1 标题与正文 */
function splitTitle(md: string): { title: string; markdown: string } {
  const lines = md.split("\n");
  let title = "未命名文档";
  let titleIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.+)$/);
    if (m) {
      title = m[1].trim();
      titleIdx = i;
      break;
    }
  }
  const body =
    titleIdx >= 0 ? lines.slice(titleIdx + 1).join("\n").trim() : md;
  return { title, markdown: body };
}
