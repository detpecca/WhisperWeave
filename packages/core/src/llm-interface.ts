import type {
  AggregateResponse,
  ClassifyRequest,
  ClassifyResponse,
  Fragment,
  LLMConfig,
} from "./types";

/**
 * LLM 适配器：抽象掉「在哪调 LLM」的差异。
 * - web 实现：调自己的 /api 路由（服务端转发，绕 CORS、藏 key）
 * - mobile 实现：直连 LLM 厂商 SSE 接口（原生无 CORS，key 走 SecureStore）
 *
 * 接口只暴露上层需要的两个动作：流式分类、流式分组织造。
 * onDelta 回调把模型原始输出逐 chunk 吐给上层（弹窗展示思考过程）。
 */
export interface LLMAdapter {
  /** 流式分类：逐 chunk 吐原始文本，结束返回结构化分组。 */
  classifyStream(
    req: ClassifyRequest,
    onDelta: (text: string) => void
  ): Promise<ClassifyResponse>;

  /** 流式分组织造：逐 chunk 吐原始 markdown，结束返回标题+正文。 */
  aggregateGroupStream(
    cfg: LLMConfig,
    groupName: string,
    fragments: { content: string; tag?: string }[],
    onDelta: (text: string) => void
  ): Promise<AggregateResponse>;
}

/** 分类请求所需的碎片子集（适配器调用方组装用）。 */
export type { Fragment };
