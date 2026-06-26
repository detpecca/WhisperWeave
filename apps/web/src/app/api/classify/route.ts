import type { NextRequest } from "next/server";
import { classifyFragments, classifyFragmentsStream } from "@whisperweave/core";
import type { ClassifyRequest } from "@whisperweave/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST 普通模式返回 JSON；POST?stream=1 走 SSE 流式。
 * 流式事件流：
 *   data: {"type":"delta","text":"..."}    模型原始输出的增量
 *   data: {"type":"done","groups":[...],"provider":"...","model":"...","elapsed":N}
 *   data: {"type":"error","error":"..."}
 *   data: [DONE]
 * 前端边读边把原始文本打进「思考过程」弹窗，逐字出现。
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const stream = url.searchParams.get("stream") === "1";
  if (stream) return postStream(req);
  try {
    const body = (await req.json()) as ClassifyRequest;
    if (!body.fragments?.length) {
      return Response.json({ error: "没有可分类的碎片" }, { status: 400 });
    }
    if (!body.config?.provider) {
      return Response.json({ error: "未配置 LLM 提供商" }, { status: 400 });
    }
    const result = await classifyFragments({
      fragments: body.fragments,
      presetTags: body.presetTags ?? [],
      config: body.config,
    });
    return Response.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

async function postStream(req: NextRequest) {
  const encoder = new TextEncoder();
  const send = (obj: unknown) =>
    encoder.encode("data: " + JSON.stringify(obj) + "\n\n");
  try {
    const body = (await req.json()) as ClassifyRequest;
    if (!body.fragments?.length) {
      return new Response(send({ type: "error", error: "没有可分类的碎片" }), {
        status: 400,
        headers: sseHeaders(),
      });
    }
    if (!body.config?.provider) {
      return new Response(send({ type: "error", error: "未配置 LLM 提供商" }), {
        status: 400,
        headers: sseHeaders(),
      });
    }
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const result = await classifyFragmentsStream(
            {
              fragments: body.fragments,
              presetTags: body.presetTags ?? [],
              config: body.config,
            },
            (text) => controller.enqueue(send({ type: "delta", text }))
          );
          controller.enqueue(
            send({
              type: "done",
              groups: result.groups,
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
