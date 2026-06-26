"use client";

import { useState } from "react";

interface Props {
  title: string;
  markdown: string;
}

/** 导出 md / html / 文本按钮组。 */
export function ExportButtons({ title, markdown }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const safeName = (s: string) =>
    s.replace(/[#<>:\\"/\\|?*\n\r\t]/g, "").trim() || "WhisperWeave";

  const exportMd = () => {
    download(`${safeName(title)}.md`, `# ${title}\n\n${markdown}`, "text/markdown");
  };

  const exportHtml = () => {
    const full = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,Segoe UI,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#141413;line-height:1.75}h1,h2,h3{color:#141413}code{background:#f0eee6;padding:2px 6px;border-radius:4px}pre{background:#080808;color:#faf9f5;padding:16px;border-radius:8px;overflow:auto}blockquote{background:#faf9f5;border-radius:4px;padding:8px 14px;color:#3d3d3a;font-style:italic;margin:12px 0}</style>
</head><body><h1>${title}</h1>${toHtmlBody(markdown)}</body></html>`;
    download(`${safeName(title)}.html`, full, "text/html");
  };

  const exportTxt = () => {
    const txt = markdown
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_`~]/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1");
    download(`${safeName(title)}.txt`, `${title}\n\n${txt}`, "text/plain");
  };

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={exportMd} className="ww-btn ww-btn-ghost text-13" title="导出 Markdown">
        <IconDownload /> .md
      </button>
      <button onClick={exportHtml} className="ww-btn ww-btn-ghost text-13" title="导出 HTML">
        <IconDownload /> .html
      </button>
      <button onClick={exportTxt} className="ww-btn ww-btn-ghost text-13" title="导出纯文本">
        <IconDownload /> .txt
      </button>
    </div>
  );
}

function IconDownload() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>;
}

/** 极简 markdown → html body（仅用于导出，与预览组件独立）。 */
function toHtmlBody(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = esc(md).split("\n");
  let out = "";
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      const m = line.match(/^(#{1,6})\s+(.*)$/)!;
      const lv = m[1].length;
      out += `<h${lv}>${m[2]}</h${lv}>`;
    } else if (/^\s*[-*+]\s+/.test(line)) {
      out += `<li>${line.replace(/^\s*[-*+]\s+/, "")}</li>`;
    } else if (line.trim() === "") {
      out += "";
    } else {
      out += `<p>${line}</p>`;
    }
  }
  return out;
}
