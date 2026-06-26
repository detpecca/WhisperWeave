// WhisperWeave 核心数据模型

export type ID = string;

/** 一条碎片化输入（碎碎念、零散笔记） */
export interface Fragment {
  id: ID;
  content: string;
  /** 主题/标签，可选 */
  tag?: string;
  createdAt: number;
  updatedAt: number;
  /** 已被纳入某篇文档后标记为 consumed */
  consumed?: boolean;
  consumedByDocId?: ID;
}

/** 生成出的结构化文档 */
export interface GeneratedDoc {
  id: ID;
  title: string;
  markdown: string;
  /** 生成所用的碎片 id 列表 */
  sourceFragmentIds: ID[];
  createdAt: number;
  updatedAt: number;
  /** 同步状态 */
  sync?: DocSyncState;
  /** 归档标记：归档后默认在列表中折叠/隐藏 */
  archived?: boolean;
}

export interface DocSyncState {
  provider: "feishu" | "none";
  remoteUrl?: string;
  remoteToken?: string;
  syncedAt?: number;
  status: "none" | "syncing" | "synced" | "error";
  error?: string;
}

/** LLM 提供商配置 */
export type LLMProvider =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "qwen"
  | "zhipu"
  | "openai-compatible";

export interface LLMConfig {
  provider: LLMProvider;
  /** 展示用名称 */
  label?: string;
  model: string;
  /** 使用的 API key（仅前端透传用，不落盘时为空） */
  apiKey?: string;
  baseUrl?: string;
}

export interface FeishuConfig {
  appId?: string;
  appSecret?: string;
  folderToken?: string;
}

export interface AppSettings {
  llm: LLMConfig;
  feishu: FeishuConfig;
  /** 聚合时的附加指令 */
  customInstruction?: string;
  /** 预设标签集合，LLM 分类时优先从这里选 */
  presetTags: string[];
}

/** 分类请求体 */
export interface ClassifyRequest {
  fragments: { id: string; content: string; tag?: string }[];
  /** 预设标签集合 */
  presetTags: string[];
  config: LLMConfig;
}

/** 一个分类分组 */
export interface ClassifyGroup {
  /** 分类名（标签） */
  tag: string;
  /** 该组碎片 id 列表 */
  fragmentIds: string[];
  /** LLM 给出的一句话理由（可选） */
  reason?: string;
  /** 标记是否为 LLM 自行新建的标签（不在预设集合内）→ 需用户确认 */
  isNewTag: boolean;
}

/** 分类响应体 */
export interface ClassifyResponse {
  groups: ClassifyGroup[];
  provider: LLMProvider;
  model: string;
  elapsed?: number;
}

/** 聚合请求体 */
export interface AggregateRequest {
  fragments: { id: string; content: string; tag?: string }[];
  /** 文档类型，影响 prompt */
  docType?: DocType;
  customInstruction?: string;
  config: LLMConfig;
}

export type DocType =
  | "auto"
  | "daily" // 日报
  | "weekly" // 周报
  | "notes" // 主题笔记
  | "memo"; // 备忘/思考

/** 聚合响应 */
export interface AggregateResponse {
  title: string;
  markdown: string;
  provider: LLMProvider;
  model: string;
  /** 耗时 ms */
  elapsed?: number;
}
