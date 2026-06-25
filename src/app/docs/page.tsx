"use client";

import { useCallback, useEffect, useState } from "react";
import type { GeneratedDoc } from "@/lib/types";
import { deleteDoc, getDoc, listDocs, saveDoc } from "@/lib/storage";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { ExportButtons } from "@/components/ExportButtons";
import { SyncButton } from "@/components/SyncButton";

export default function DocsPage() {
  const [docs, setDocs] = useState<GeneratedDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  const refresh = useCallback(() => {
    const list = listDocs();
    setDocs(list);
    // keep selection valid
    if (selectedId && list.some((d) => d.id === selectedId)) {
      // keep
    } else if (list.length > 0) {
      loadDoc(list[0].id);
    } else {
      setSelectedId(null); setTitle(""); setMarkdown("");
    }
  }, [selectedId]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadDoc = (id: string) => {
    const d = getDoc(id);
    if (!d) return;
    setSelectedId(d.id);
    setTitle(d.title);
    setMarkdown(d.markdown);
    setShowPreview(true);
  };

  const persistDoc = () => {
    if (!selectedId) return;
    const d = getDoc(selectedId);
    saveDoc({
      id: selectedId, title, markdown,
      sourceFragmentIds: d?.sourceFragmentIds ?? [],
      createdAt: d?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      sync: d?.sync,
    });
    refresh();
  };

  return (
    <div className="flex h-full">
      {/* 左：文档列表 */}
      <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-ink-200 p-4">
        <h1 className="font-serif text-20 font-semibold text-ink-900">文档</h1>
        <p className="text-12 text-ink-600 mt-0.5 mb-4">已织造成稿</p>
        {docs.length === 0 ? (
          <div className="ww-empty py-10">
            <div className="ww-empty-icon"><IconDoc /></div>
            <div className="ww-empty-title">还没有文档</div>
            <div className="ww-empty-desc">去织造页生成第一篇</div>
          </div>
        ) : (
          <ul className="space-y-1">
            {docs.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => loadDoc(d.id)}
                  className={`flex w-full flex-col items-start rounded-DEFAULT px-3 py-2 text-left transition-colors hover:bg-ink-50 ${selectedId === d.id ? "bg-ink-100" : ""}`}
                >
                  <span className="w-full truncate text-13 font-medium text-ink-900">{d.title}</span>
                  <span className="text-11 text-ink-600">
                    {new Date(d.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {d.sync?.status === "synced" && <span className="ml-1 text-accent">· 已同步</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* 右：编辑器 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-6">
        {selectedId ? (
          <div className="ww-card flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center gap-2 px-5 pt-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="ww-title-input"
                placeholder="文档标题"
              />
              <div className="ml-auto flex items-center gap-2 pb-1">
                <button onClick={() => setShowPreview((v) => !v)} className="ww-btn ww-btn-ghost text-12" title="切换预览">
                  {showPreview ? <IconEdit /> : <IconEye />}
                  {showPreview ? "仅编辑" : "编辑+预览"}
                </button>
              </div>
            </div>
            <div className={`grid min-h-0 flex-1 ${showPreview ? "grid-cols-2" : "grid-cols-1"}`}>
              <div className={showPreview ? "border-r border-ink-200" : ""}>
                <textarea
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  className="h-full w-full resize-none bg-transparent p-5 font-mono text-13 leading-relaxed text-ink-900 outline-none"
                />
              </div>
              {showPreview && (
                <div className="min-h-0 overflow-y-auto p-5">
                  {markdown ? <MarkdownPreview md={markdown} /> : <div className="ww-empty py-10"><div className="ww-empty-title">空文档</div></div>}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 py-2.5 border-t border-ink-200">
              <button onClick={persistDoc} className="ww-btn ww-btn-ghost text-13"><IconSave /> 保存</button>
              <ExportButtons title={title || "未命名文档"} markdown={markdown} />
              <SyncButton
                title={title || "未命名文档"}
                markdown={markdown}
                onSynced={(info) => {
                  const d = getDoc(selectedId);
                  if (d) {
                    saveDoc({
                      ...d, title, markdown, updatedAt: Date.now(),
                      sync: { provider: "feishu", remoteUrl: info.url, remoteToken: info.token, status: "synced", syncedAt: Date.now() },
                    });
                    refresh();
                  }
                }}
              />
              <div className="flex-1" />
              <button
                onClick={() => {
                  if (confirm("删除这篇文档？不可撤销。")) { deleteDoc(selectedId); setSelectedId(null); refresh(); }
                }}
                className="text-12 text-ink-600 hover:text-red-500"
              >
                删除
              </button>
            </div>
          </div>
        ) : (
          <div className="ww-empty h-full">
            <div className="ww-empty-icon"><IconDoc /></div>
            <div className="ww-empty-title">选择左侧文档查看</div>
            <div className="ww-empty-desc">或去织造页生成一篇</div>
          </div>
        )}
      </div>
    </div>
  );
}
function IconDoc() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>; }
function IconEdit() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>; }
function IconEye() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>; }
function IconSave() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>; }
