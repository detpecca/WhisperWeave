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

/** 支持单篇聚合（POST）与「按分组织造成篇」子动作（?mode=group）。 */
export async function PUT(req: NextRequest) {
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
