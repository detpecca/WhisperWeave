import type { NextRequest } from "next/server";
import type { FeishuConfig } from "@whisperweave/core";
import { syncMarkdownToFeishu } from "@whisperweave/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SyncBody {
  title: string;
  markdown: string;
  folderToken?: string;
  cfg?: FeishuConfig;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SyncBody;
    if (!body.markdown) {
      return Response.json({ error: "缺少文档内容" }, { status: 400 });
    }
    const result = await syncMarkdownToFeishu({
      title: body.title || "未命名文档",
      markdown: body.markdown,
      folderToken: body.folderToken,
      cfg: body.cfg,
    });
    return Response.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
