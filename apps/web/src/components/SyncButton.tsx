"use client";

import { useState } from "react";
import Link from "next/link";
import { getSettings } from "@/lib/storage";

interface Props {
  title: string;
  markdown: string;
  onSynced?: (info: { url: string; token: string }) => void;
}

interface SyncResponse {
  url: string;
  token: string;
  title: string;
}

/** 一键同步到飞书云文档按钮。 */
export function SyncButton({ title, markdown, onSynced }: Props) {
  const [status, setStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const sync = async () => {
    if (!markdown) return;
    const cfg = getSettings().feishu;
    if (!cfg.appId || !cfg.appSecret) {
      setMsg(null);
      setStatus("error");
      return;
    }
    setStatus("syncing");
    setMsg("正在推送到飞书…");
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, markdown, folderToken: cfg.folderToken, cfg }),
      });
      const data = (await res.json()) as SyncResponse | { error: string };
      if (!res.ok) {
        throw new Error((data as { error: string }).error || "同步失败");
      }
      const r = data as SyncResponse;
      setUrl(r.url);
      setStatus("synced");
      setMsg("已同步");
      onSynced?.({ url: r.url, token: r.token });
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const configured = !!getSettings().feishu.appId;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={sync}
        disabled={status === "syncing" || !markdown}
        className="ww-btn ww-btn-ghost text-13"
        title={configured ? "同步到飞书云文档" : "需要先在设置页配置飞书应用凭证"}
      >
        <IconCloud />
        {status === "syncing" ? "同步中…" : "同步飞书"}
      </button>
      {status === "synced" && url && (
        <a href={url} target="_blank" rel="noreferrer" className="text-12 text-accent-dark underline">
          在飞书中打开 ↗
        </a>
      )}
      {status === "error" && (
        <span className="ww-error text-12">
          {msg?.includes("App ID") || msg?.includes("未配置") ? (
            <>
              未配置飞书，<Link href="/settings" className="underline">去设置</Link>
            </>
          ) : (
            msg
          )}
        </span>
      )}
    </div>
  );
}

function IconCloud() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.5-1A4 4 0 0 0 6 19h11.5Z" /></svg>;
}
