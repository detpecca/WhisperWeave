import type { NextRequest } from "next/server";
import { classifyFragments } from "@/lib/llm";
import type { ClassifyRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
