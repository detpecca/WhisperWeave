"use client";

import { useCallback, useEffect, useState } from "react";
import type { GeneratedDoc, ID } from "@whisperweave/core";
import {
  archiveDocs,
  deleteDoc,
  deleteDocs,
  getDoc,
  getSettings,
  listDocs,
  saveDoc,
} from "@/lib/storage";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { ExportButtons } from "@/components/ExportButtons";
import { SyncButton } from "@/components/SyncButton";

export default function DocsPage() {
  const [docs, setDocs] = useState<GeneratedDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [selected, setSelected] = useState<Set<ID>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const refresh = useCallback(() => {
    const list = listDocs();
    setDocs(list);
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
      archived: d?.archived,
    });
    refresh();
  };

  const toggleSelect = (id: ID) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const visible = docs.filter((d) => showArchived || !d.archived);
    setSelected(new Set(visible.map((d) => d.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const batchDelete = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`删除选中的 ${ids.length} 篇文档？不可撤销。`)) return;
    deleteDocs(ids);
    if (selectedId && ids.includes(selectedId)) {
      setSelectedId(null); setTitle(""); setMarkdown("");
    }
    clearSelection();
    refresh();
  };

  const batchArchive = (archived: boolean) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    archiveDocs(ids, archived);
    clearSelection();
    refresh();
  };

  const batchExportMd = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const all = listDocs();
    const picked = all.filter((d) => ids.includes(d.id));
    if (picked.length === 0) return;
    if (picked.length === 1) {
      const d = picked[0];
      downloadFile(`${safeName(d.title)}.md`, `# ${d.title}\n\n${d.markdown}`, "text/markdown");
      return;
    }
    const merged = picked.map((d) => `# ${d.title}\n\n${d.markdown}`).join("\n\n---\n\n");
    downloadFile(`WhisperWeave-${picked.length}篇.md`, merged, "text/markdown");
  };

  const batchSyncFeishu = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const all = listDocs();
    const picked = all.filter((d) => ids.includes(d.id));
    if (picked.length === 0) return;
    const cfg = getSettings().feishu;
    if (!cfg.appId || !cfg.appSecret) {
      alert("未配置飞书应用凭证，请先去设置页配置。");
      return;
    }
    if (!confirm(`将选中的 ${picked.length} 篇文档推送到飞书？`)) return;
    let ok = 0;
    let fail = 0;
    for (const d of picked) {
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: d.title, markdown: d.markdown, folderToken: cfg.folderToken, cfg }),
        });
        if (!res.ok) { fail++; continue; }
        const data = await res.json();
        saveDoc({
          ...d,
          sync: { provider: "feishu", remoteUrl: data.url, remoteToken: data.token, status: "synced", syncedAt: Date.now() },
        });
        ok++;
      } catch {
        fail++;
      }
    }
    alert(`同步完成：成功 ${ok} 篇${fail ? `，失败 ${fail} 篇` : ""}`);
    refresh();
  };

  const visibleDocs = docs.filter((d) => showArchived || !d.archived);
  const allSelected = visibleDocs.length > 0 && visibleDocs.every((d) => selected.has(d.id));
  const currentArchived = selectedId ? getDoc(selectedId)?.archived : undefined;

  return (
    <div className="flex h-full">
      {/* 左：文档列表 */}
      <aside className="w-[300px] shrink-0 overflow-y-auto border-r border-ink-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-20 font-semibold text-ink-900">文档</h1>
            <p className="text-12 text-ink-600 mt-0.5">已织造成稿</p>
          </div>
          <label className="flex cursor-pointer items-center gap-1 text-11 text-ink-600" title="显示/隐藏已归档">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-accent"
            />
            归档
          </label>
        </div>

        {/* 批量工具条 */}
        {visibleDocs.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-DEFAULT bg-ink-50 px-2.5 py-2">
            <button
              onClick={() => (allSelected ? clearSelection() : selectAll())}
              className="text-11 text-ink-700 hover:text-ink-900"
              title={allSelected ? "取消全选" : "全选"}
            >
              {allSelected ? "取消全选" : "全选"}
            </button>
            <span className="text-11 text-ink-600">
              {selected.size > 0 ? `已选 ${selected.size}` : ""}
            </span>
            <div className="flex-1" />
            {selected.size > 0 && (
              <>
                <button onClick={batchExportMd} className="text-11 text-ink-700 hover:text-accent-dark" title="批量导出 Markdown">
                  导出
                </button>
                <button onClick={batchSyncFeishu} className="text-11 text-ink-700 hover:text-accent-dark" title="批量同步飞书">
                  同步
                </button>
                <button onClick={() => batchArchive(true)} className="text-11 text-ink-700 hover:text-accent-dark" title="批量归档">
                  归档
                </button>
                <button onClick={batchDelete} className="text-11 text-red-500 hover:text-red-600" title="批量删除">
                  删除
                </button>
              </>
            )}
          </div>
        )}

        {visibleDocs.length === 0 ? (
          <div className="ww-empty py-10">
            <div className="ww-empty-icon"><IconDoc /></div>
            <div className="ww-empty-title">{docs.length === 0 ? "还没有文档" : "没有可见文档"}</div>
            <div className="ww-empty-desc">去织造页生成第一篇</div>
          </div>
        ) : (
          <ul className="mt-2 space-y-1">
            {visibleDocs.map((d) => (
              <li key={d.id} className="group">
                <div
                  className={`flex items-start gap-2 rounded-DEFAULT px-2 py-2 transition-colors hover:bg-ink-50 ${selectedId === d.id ? "bg-ink-100" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    onChange={() => toggleSelect(d.id)}
                    className="mt-1 shrink-0 accent-accent"
                    aria-label={`选择 ${d.title}`}
                  />
                  <button
                    onClick={() => loadDoc(d.id)}
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                  >
                    <span className={`w-full truncate text-13 font-medium ${d.archived ? "text-ink-600" : "text-ink-900"}`}>{d.title}</span>
                    <span className="text-11 text-ink-600">
                      {new Date(d.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {d.sync?.status === "synced" && <span className="ml-1 text-accent">· 已同步</span>}
                      {d.archived && <span className="ml-1 text-ink-500">· 已归档</span>}
                    </span>
                  </button>
                </div>
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
              <button
                onClick={() => {
                  if (selectedId) {
                    archiveDocs([selectedId], !currentArchived);
                    refresh();
                  }
                }}
                className="text-12 text-ink-600 hover:text-ink-900"
                title={currentArchived ? "取消归档" : "归档"}
              >
                {currentArchived ? "取消归档" : "归档"}
              </button>
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

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(s: string) {
  return s.replace(/[#<>:"/\\|?*\n\r\t]/g, "").trim() || "WhisperWeave";
}

function IconDoc() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>; }
function IconEdit() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>; }
function IconEye() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>; }
function IconSave() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>; }
