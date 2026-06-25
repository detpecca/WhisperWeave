import type { FeishuConfig } from "./types";

/**
 * 飞书云文档同步客户端。
 * 走服务端 API Route 代理，tenant_access_token 由后端用 app_id/secret 换取。
 * 文档参考：https://open.feishu.cn/document
 */

const BASE = "https://open.feishu.cn/open-apis";

interface CachedToken {
  token: string;
  expireAt: number;
}
let tokenCache: CachedToken | null = null;

export function resolveFeishuCreds(cfg?: FeishuConfig): {
  appId: string;
  appSecret: string;
  folderToken?: string;
} {
  const appId = cfg?.appId || process.env.FEISHU_APP_ID || "";
  const appSecret = cfg?.appSecret || process.env.FEISHU_APP_SECRET || "";
  const folderToken = cfg?.folderToken || process.env.FEISHU_FOLDER_TOKEN || "";
  if (!appId || !appSecret) {
    throw new Error("未配置飞书 App ID / App Secret（设置页或 .env）");
  }
  return { appId, appSecret, folderToken };
}

/** 获取 tenant_access_token，带本地缓存。 */
export async function getTenantAccessToken(cfg?: FeishuConfig): Promise<string> {
  if (tokenCache && tokenCache.expireAt > Date.now() + 60_000) {
    return tokenCache.token;
  }
  const { appId, appSecret } = resolveFeishuCreds(cfg);
  const res = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`获取飞书 token 失败 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`获取飞书 token 出错: ${data.msg}`);
  }
  tokenCache = {
    token: data.tenant_access_token,
    expireAt: Date.now() + (data.expire || 7200) * 1000,
  };
  return tokenCache.token;
}

export interface SyncResult {
  url: string;
  token: string;
  title: string;
}

/**
 * 把 markdown 文档同步到飞书云文档。
 * 策略：用「创建文档」接口建一篇 wiki/docx，再把 markdown 内容以块方式写入。
 * 这里采用较稳的「云文档」docx：import_task 导入 markdown 为 docx。
 */
export async function syncMarkdownToFeishu(params: {
  title: string;
  markdown: string;
  folderToken?: string;
  cfg?: FeishuConfig;
}): Promise<SyncResult> {
  const token = await getTenantAccessToken(params.cfg);
  const { folderToken } = resolveFeishuCreds(params.cfg);

  // 1) 调用导入接口，将 markdown 导入为飞书 docx
  const boundary = "----WWBoundary" + Math.random().toString(16).slice(2);
  const fileName = `${sanitize(params.title) || "WhisperWeave"}.md`;
  const fileContent = `# ${params.title}\n\n${params.markdown}`;

  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file_name"\r\n\r\n${fileName}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="parent_type"\r\n\r\n${folderToken ? "explorer" : "ccm"}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="parent_node_token"\r\n\r\n${folderToken || ""}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="type"\r\n\r\ndocx\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="extra"\r\n\r\n{"notification":false}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: text/markdown\r\n\r\n${fileContent}\r\n` +
    `--${boundary}--\r\n`;

  const importRes = await fetch(`${BASE}/drive/v1/import_tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
    cache: "no-store",
  });

  if (!importRes.ok) {
    const detail = await importRes.text().catch(() => "");
    throw new Error(`飞书导入失败 (${importRes.status}): ${detail.slice(0, 500)}`);
  }
  const importData = await importRes.json();
  const ticket = importData?.data?.ticket;
  if (!ticket) {
    throw new Error(`飞书导入未返回 ticket: ${JSON.stringify(importData).slice(0, 500)}`);
  }

  // 2) 轮询导入任务直到完成
  const token_ = token;
  const doc = await pollImportTask(ticket, token_);
  return {
    url: `https://www.feishu.cn/docx/${doc.token}`,
    token: doc.token,
    title: params.title,
  };
}

async function pollImportTask(
  ticket: string,
  token: string,
  retries = 20
): Promise<{ token: string; url: string }> {
  for (let i = 0; i < retries; i++) {
    await sleep(1500);
    const res = await fetch(`${BASE}/drive/v1/import_tasks/${ticket}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) continue;
    const data = await res.json();
    const t = data?.data?.result;
    const jobStatus = t?.job_status;
    if (jobStatus === 0 || jobStatus === 4 || t?.token) {
      // success
      if (t?.token) {
        return { token: t.token, url: t.url || "" };
      }
    }
    if (jobStatus === 1 || jobStatus === 2) {
      // 失败
      throw new Error(`飞书导入任务失败: ${JSON.stringify(t).slice(0, 300)}`);
    }
  }
  throw new Error("飞书导入任务超时，请稍后到云空间查看");
}

/** 列出指定文件夹下的云文档（用于选择同步目标）。 */
export async function listFeishuFolder(cfg?: FeishuConfig, folderToken?: string) {
  const token = await getTenantAccessToken(cfg);
  const ft = folderToken || resolveFeishuCreds(cfg).folderToken || "";
  const url = `${BASE}/drive/v1/files${ft ? `?folder_token=${encodeURIComponent(ft)}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`列出飞书文件夹失败 (${res.status})`);
  }
  const data = await res.json();
  return data?.data?.files ?? [];
}

function sanitize(s: string): string {
  return (s || "").replace(/[#<>:\\"/\\|?*\n\r\t]/g, "").trim().slice(0, 60);
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
