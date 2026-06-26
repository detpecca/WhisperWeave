import type { NextRequest } from "next/server";
import { aggregateWithLLM } from "@/lib/llm";
import type { AggregateRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AggregateRequest;
    if (!body.fragments?.length) {
      return Response.json({ error: "没有可聚合的碎片" }, { status: 400 });
    }
    if (!body.config?.provider) {
      return Response.json({ error: "未配置 LLM 提供商" }, { status: 400 });
    }
    const result = await aggregateWithLLM(body);
    return Response.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

export interface GroupAggregateBody {
  groupName: string;
  fragments: { content: string; tag?: string }[];
  config: AggregateRequest["config"];
  sourceIds?: string[];
}

/** 按分组织造成篇。PUT 普通模式返回 JSON；PUT?stream=1 走 SSE 流式。
 * 流式事件流：
 *   data: {"type":"delta","text":"..."}    每段增量 markdown
 *   data: {"type":"done","title":"...","markdown":"...","provider":"...","model":"...","elapsed":N}
 *   data: {"type":"error","error":"..."}
 *   data: [DONE]
 * 前端边读边把 markdown 打进预览区，逐字出现，像看 LLM 实时思考。
 */
export async function PUT(req: NextRequest) {
  const url = new URL(req.url);
  const stream = url.searchParams.get("stream") === "1";
  if (stream) return putStream(req);
  try {
    const body = (await req.json()) as GroupAggregateBody;
    if (!body.fragments?.length) {
      return Response.json({ error: "缺少碎片" }, { status: 400 });
    }
    const { aggregateGroupWithLLM } = await import("@/lib/llm");
    const result = await aggregateGroupWithLLM(
      body.config,
      body.groupName || "未命名主题",
      body.fragments,
      body.sourceIds ?? []
    );
    return Response.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

async function putStream(req: NextRequest) {
  const encoder = new TextEncoder();
  const send = (obj: unknown) =>
    encoder.encode("data: " + JSON.stringify(obj) + "\n\n");
  try {
    const body = (await req.json()) as GroupAggregateBody;
    if (!body.fragments?.length) {
      return new Response(send({ type: "error", error: "缺少碎片" }), {
        status: 400,
        headers: sseHeaders(),
      });
    }
    const { aggregateGroupWithLLMStream } = await import("@/lib/llm");
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const result = await aggregateGroupWithLLMStream(
            body.config,
            body.groupName || "未命名主题",
            body.fragments,
            (text) => controller.enqueue(send({ type: "delta", text }))
          );
          controller.enqueue(
            send({
              type: "done",
              title: result.title,
              markdown: result.markdown,
              provider: result.provider,
              model: result.model,
              elapsed: result.elapsed,
            })
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          controller.enqueue(send({ type: "error", error: msg }));
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: sseHeaders() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(send({ type: "error", error: msg }), {
      status: 500,
      headers: sseHeaders(),
    });
  }
}

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}
