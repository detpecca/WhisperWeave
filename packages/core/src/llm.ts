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

/** 流式聚合：逐 chunk 把原始文本吐给 onDelta，结束后返回拆分后的结构化结果。
 * 用于「实时看到 LLM 思考过程」。*/
export async function aggregateGroupWithLLMStream(
  cfg: LLMConfig,
  groupName: string,
  fragments: { content: string; tag?: string }[],
  onDelta: (text: string) => void
): Promise<AggregateResponse> {
  const { system, user } = buildGroupAggregatePrompt(fragments, groupName);
  const start = Date.now();
  const raw = await callLLMStream(cfg, system, user, onDelta);
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
  return finalizeClassify(req, raw, start);
}

/** 流式分类：逐 chunk 把模型原始输出吐给 onDelta（让前端能看到 LLM 思考），
 * 结束后从 raw 里提取 ```json 代码块解析出 ClassifyResponse。
 * 设计：让模型先输出自然语言分析（用户可读的思考过程），再输出 JSON 代码块，
 * 流式弹窗里看到的就是分析→JSON 的自然过渡，而不是上来一堆 JSON。 */
export async function classifyFragmentsStream(
  req: ClassifyRequest,
  onDelta: (text: string) => void
): Promise<ClassifyResponse> {
  const { system, user } = buildClassifyPrompt(req.fragments, req.presetTags);
  const start = Date.now();
  const raw = await callLLMStream(req.config, system, user, onDelta);
  return finalizeClassify(req, raw, start);
}

/** 分类结果共用收尾：解析 JSON + 补 isNewTag 兜底 + 校验非空。 */
function finalizeClassify(
  req: ClassifyRequest,
  raw: string,
  start: number
): ClassifyResponse {
  let groups = normalizeClassifyGroups(extractJSON(raw));
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

/** 内部：非流式调用 + 拆分标题/正文。 */
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

/** 流式调用：逐 chunk 回调 onDelta，返回完整拼接文本。 */
async function callLLMStream(
  cfg: LLMConfig,
  system: string,
  user: string,
  onDelta: (text: string) => void
): Promise<string> {
  switch (cfg.provider) {
    case "anthropic":
      return callAnthropicStream(cfg, system, user, onDelta);
    case "openai":
    case "deepseek":
    case "qwen":
    case "zhipu":
    case "openai-compatible":
    default:
      return callOpenAICompatibleStream(cfg, system, user, onDelta);
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

/** OpenAI 兼容流式：SSE data: 行，解析 choices[0].delta.content。
 * 逐 chunk 回调 onDelta，并在内部拼接完整文本返回（用于后续 stripCodeFence/splitTitle）。 */
async function callOpenAICompatibleStream(
  cfg: LLMConfig,
  system: string,
  user: string,
  onDelta: (text: string) => void
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
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
      stream: true,
    }),
    cache: "no-store",
  });

  if (!res.ok || !res.body) {
    const detail = await safeText(res);
    throw new Error(`LLM 请求失败 (${res.status}): ${detail.slice(0, 500)}`);
  }
  let full = "";
  await readSSE(res.body, (json) => {
    if (!json) return;
    const delta = (json as any)?.choices?.[0]?.delta?.content ?? "";
    if (delta) {
      full += delta;
      onDelta(delta);
    }
  });
  if (!full) throw new Error("LLM 流式返回内容为空");
  return full;
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

/** Anthropic 流式：SSE event: content_block_delta，解析 delta.text。
 * 逐 chunk 回调 onDelta，内部拼接完整文本返回。 */
async function callAnthropicStream(
  cfg: LLMConfig,
  system: string,
  user: string,
  onDelta: (text: string) => void
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
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
      stream: true,
    }),
    cache: "no-store",
  });

  if (!res.ok || !res.body) {
    const detail = await safeText(res);
    throw new Error(`Claude 请求失败 (${res.status}): ${detail.slice(0, 500)}`);
  }
  let full = "";
  await readSSE(res.body, (json) => {
    if (!json) return;
    if ((json as any)?.type === "content_block_delta") {
      const text = (json as any)?.delta?.text ?? "";
      if (text) {
        full += text;
        onDelta(text);
      }
    }
  });
  if (!full) throw new Error("Claude 流式返回内容为空");
  return full;
}

/** 通用 SSE 读取：按 \n\n 分块、提取 data: 行、回调解析后的 JSON。
 * 兼容两种 SSE 行格式：
 * - 标准 "data: {...}"（前缀后有空格）
 * - 紧凑 "data:{...}"（无空格，部分代理会这样）
 * 同时兼容单行内多次 data: 出现的情况。
 * 返回 void；调用方在回调里自行拼接完整文本。 */
async function readSSE(
  body: ReadableStream<Uint8Array>,
  onData: (json: unknown) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // 按 \n\n 切块（标准 SSE 事件分隔）；也兼容 \r\n\r\n
    let idx: number;
    while ((idx = findEventBoundary(buf)) >= 0) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + boundaryLen(buf, idx));
      parseSSEBlock(block, onData);
    }
  }
  // 流结束后 flush 残留（最后一个事件可能没有 trailing 空行）
  if (buf.trim()) parseSSEBlock(buf, onData);
}

/** 找下一个 SSE 事件边界（\n\n 或 \r\n\r\n）的位置。 */
function findEventBoundary(buf: string): number {
  const i = buf.indexOf("\n\n");
  const j = buf.indexOf("\r\n\r\n");
  if (i < 0) return j;
  if (j < 0) return i;
  return Math.min(i, j);
}
function boundaryLen(buf: string, idx: number): number {
  return buf.slice(idx, idx + 4) === "\r\n\r\n" ? 4 : 2;
}

/** 解析一个 SSE 事件块：提取所有 data: 行，拼接后尝试 JSON.parse。
 * 多行 data: 按 SSE 规范应拼接为一（这里也合并）。 */
function parseSSEBlock(block: string, onData: (json: unknown) => void) {
  let dataLines: string[] = [];
  for (const rawLine of block.split(/\r?\n/)) {
    if (!rawLine.startsWith("data:")) continue;
    const data = rawLine.slice(5).trim();
    if (!data) continue;
    if (data === "[DONE]") continue;
    dataLines.push(data);
  }
  if (dataLines.length === 0) return;
  const joined = dataLines.join("\n");
  try {
    onData(JSON.parse(joined));
  } catch {
    // 单块 JSON 不完整时忽略（理论上按 \n\n 切应该完整，但保险起见）
  }
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
