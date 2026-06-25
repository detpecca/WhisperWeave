"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  AggregateResponse,
  ClassifyGroup,
  ClassifyResponse,
  DocType,
  Fragment,
} from "@/lib/types";
import {
  getSettings,
  listFragments,
  markFragmentsConsumed,
  saveDoc,
  saveSettings,
  tagFragments,
  unmarkFragmentsConsumed,
} from "@/lib/storage";
import { docTypeLabel } from "@/lib/prompt";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { ExportButtons } from "@/components/ExportButtons";
import { SyncButton } from "@/components/SyncButton";
import { ClassifyConfirm } from "@/components/ClassifyConfirm";

/** 一次织造批次：用于「撤回这次织造」。 */
interface WeaveBatch {
  docIds: string[];
  fragmentIds: string[];
  createdAt: number;
}

export default function WeavePage() {
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [docType, setDocType] = useState<DocType>("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [classifyBusy, setClassifyBusy] = useState(false);
  const [classifyGroups, setClassifyGroups] = useState<ClassifyGroup[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [lastMeta, setLastMeta] = useState<{ provider: string; model: string; elapsed?: number } | null>(null);
  /** 当前编辑器里这篇文档的来源碎片，用于呈现「这篇用了哪些碎片」。 */
  const [sourceFragments, setSourceFragments] = useState<Fragment[]>([]);
  /** 最近一次织造批次（可整批撤回）。 */
  const [lastBatch, setLastBatch] = useState<WeaveBatch | null>(null);
  /** 完成公告：织造完成后短暂展示。 */
  const [doneNotice, setDoneNotice] = useState<{ count: number; docIds: string[] } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshFragments = useCallback(() => setFragments(listFragments()), []);
  useEffect(() => { refreshFragments(); }, [refreshFragments]);

  const pending = useMemo(() => fragments.filter((f) => !f.consumed), [fragments]);

  const fragmentsById = useCallback(
    (ids: string[]): Fragment[] => {
      const byId = new Map(fragments.map((f) => [f.id, f]));
      return ids.map((i) => byId.get(i)).filter(Boolean) as Fragment[];
    },
    [fragments]
  );

  const weave = async () => {
    setError(null);
    if (pending.length === 0) {
      setError("没有未织造的碎片了，先去记几条");
      return;
    }
    if (pending.length < 2) {
      await aggregateSingle(pending);
      return;
    }

    setProgress("正在分类…");
    setLoading(true);
    try {
      const s = getSettings();
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fragments: pending.map((f) => ({ id: f.id, content: f.content, tag: f.tag })),
          presetTags: s.presetTags,
          config: s.llm,
        }),
      });
      const data = (await res.json()) as ClassifyResponse | { error: string };
      if (!res.ok) throw new Error((data as { error: string }).error || "分类失败");
      setClassifyGroups((data as ClassifyResponse).groups);
      setClassifyOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const classifyPreviewMap = useMemo(() => {
    const byId = new Map(fragments.map((f) => [f.id, f.content]));
    const m: Record<string, string[]> = {};
    classifyGroups.forEach((g, i) => {
      m[`${i}-${g.tag}`] = g.fragmentIds.map((id) => byId.get(id)).filter(Boolean) as string[];
    });
    return m;
  }, [classifyGroups, fragments]);

  const confirmClassify = async (groups: ClassifyGroup[]) => {
    setClassifyBusy(true);
    setClassifyOpen(false);
    setLoading(true);
    const s = getSettings();
    const newTags = Array.from(new Set(groups.filter((g) => g.isNewTag).map((g) => g.tag)));
    if (newTags.length) saveSettings({ ...s, presetTags: Array.from(new Set([...s.presetTags, ...newTags])) });
    groups.forEach((g) => tagFragments(g.fragmentIds, g.tag));
    const total = groups.length;
    let done = 0;
    setProgress(`织造 0/${total}…`);
    const batchDocIds: string[] = [];
    const batchFragIds = Array.from(new Set(groups.flatMap((g) => g.fragmentIds)));
    try {
      const results = await Promise.all(
        groups.map(async (g) => {
          const groupFrags = fragmentsById(g.fragmentIds);
          const r = await fetch("/api/aggregate", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              groupName: g.tag,
              fragments: groupFrags.map((f) => ({ content: f.content, tag: g.tag })),
              config: s.llm,
              sourceIds: g.fragmentIds,
            }),
          });
          const d = (await r.json()) as AggregateResponse | { error: string };
          if (!r.ok) throw new Error(`[${g.tag}] ${(d as { error: string }).error || "织造失败"}`);
          const doc = d as AggregateResponse;
          done += 1;
          setProgress(`织造 ${done}/${total}…`);
          const now = Date.now();
          const id = `doc-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          saveDoc({ id, title: doc.title, markdown: doc.markdown, sourceFragmentIds: g.fragmentIds, createdAt: now, updatedAt: now, sync: { provider: "none", status: "none" } });
          markFragmentsConsumed(g.fragmentIds, id);
          batchDocIds.push(id);
          return { id, ...doc };
        })
      );
      const first = results[0];
      if (first) {
        setDocId(first.id);
        setTitle(first.title);
        setMarkdown(first.markdown);
        setLastMeta({ provider: first.provider, model: first.model, elapsed: first.elapsed });
        setSourceFragments(fragmentsById(groups[0].fragmentIds));
      }
      const batch: WeaveBatch = { docIds: batchDocIds, fragmentIds: batchFragIds, createdAt: Date.now() };
      setLastBatch(batch);
      // 完成公告
      setDoneNotice({ count: results.length, docIds: batchDocIds });
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setDoneNotice(null), 5000);
      refreshFragments();
      setProgress(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setClassifyBusy(false);
      setProgress(null);
    }
  };

  /** 整批撤回最近一次织造：删本批全部文档 + un-consume 全部碎片。 */
  const undoLastBatch = () => {
    if (!lastBatch) return;
    const { docIds, fragmentIds } = lastBatch;
    if (!confirm(`撤回这次织造？将删除 ${docIds.length} 篇文档并恢复 ${fragmentIds.length} 条碎片。`)) return;
    unmarkFragmentsConsumed(fragmentIds, docIds);
    setLastBatch(null);
    setDoneNotice(null);
    // 若当前编辑器里是本批文档,清空
    if (docId && docIds.includes(docId)) {
      setDocId(null);
      setTitle("");
      setMarkdown("");
      setSourceFragments([]);
      setLastMeta(null);
    }
    refreshFragments();
  };

  const aggregateSingle = async (fs: Fragment[]) => {
    const cfg = getSettings().llm;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/aggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fragments: fs.map((f) => ({ id: f.id, content: f.content, tag: f.tag })),
          docType,
          customInstruction: getSettings().customInstruction,
          config: cfg,
        }),
      });
      const data = (await res.json()) as AggregateResponse | { error: string };
      if (!res.ok) throw new Error((data as { error: string }).error || "聚合失败");
      const d = data as AggregateResponse;
      const now = Date.now();
      const id = docId || `doc-${now.toString(36)}`;
      setDocId(id);
      setTitle(d.title);
      setMarkdown(d.markdown);
      setLastMeta({ provider: d.provider, model: d.model, elapsed: d.elapsed });
      setSourceFragments(fs);
      saveDoc({ id, title: d.title, markdown: d.markdown, sourceFragmentIds: fs.map((f) => f.id), createdAt: now, updatedAt: now, sync: { provider: "none", status: "none" } });
      markFragmentsConsumed(fs.map((f) => f.id), id);
      setLastBatch({ docIds: [id], fragmentIds: fs.map((f) => f.id), createdAt: now });
      setDoneNotice({ count: 1, docIds: [id] });
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setDoneNotice(null), 5000);
      refreshFragments();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const newDoc = () => { setDocId(null); setTitle(""); setMarkdown(""); setLastMeta(null); setSourceFragments([]); };

  const persistDoc = () => {
    if (!docId) return;
    saveDoc({ id: docId, title, markdown, sourceFragmentIds: sourceFragments.map((f) => f.id), createdAt: Date.now(), updatedAt: Date.now() });
  };

  return (
    <div className="flex h-full flex-col">
      {/* 工具条 */}
      <div className="ww-card mx-6 mt-4 flex shrink-0 flex-wrap items-center gap-2 p-3">
        <label className="text-13 text-ink-700" htmlFor="doc-type">织成</label>
        <select
          id="doc-type"
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocType)}
          className="ww-input w-auto py-1.5 text-13"
          title="单条碎片时或手动模式的文章类型"
        >
          {(["auto", "daily", "weekly", "notes", "memo"] as DocType[]).map((t) => (
            <option key={t} value={t}>{docTypeLabel(t)}</option>
          ))}
        </select>
        <span className="text-12 text-ink-600">
          自动扫描 <span className="font-semibold text-ink-800">{pending.length}</span> 条未织碎片 · 分类后多篇织造
        </span>
        <div className="flex-1" />
        {docId && (
          <button onClick={newDoc} className="ww-btn ww-btn-ghost text-13">
            <IconPlus /> 新建
          </button>
        )}
        <button onClick={weave} disabled={loading || pending.length === 0} className="ww-btn ww-btn-primary text-13">
          <IconLoom />
          {loading ? progress || "织造中…" : pending.length === 0 ? "无待织碎片" : "一键自动织造"}
        </button>
      </div>

      {/* 完成公告（peak-end）：ww-fade 绑 arrival，~5s 自隐 */}
      {doneNotice && !loading && (
        <div
          className="ww-fade mx-6 mt-3 flex shrink-0 items-center gap-3 rounded-DEFAULT px-4 py-2.5"
          role="status"
          aria-live="polite"
          style={{ background: "var(--c-ochre-tint)", color: "var(--c-ochre-deep)" }}
        >
          <IconCheck />
          <span className="text-13 font-medium">织造完成 · {doneNotice.count} 篇文档已生成</span>
          {doneNotice.count > 1 && (
            <Link href="/docs" className="text-12 underline">查看全部 →</Link>
          )}
          <div className="flex-1" />
          <button onClick={undoLastBatch} className="text-12 hover:underline" title="删除本批文档并恢复碎片">
            撤回这次织造
          </button>
        </div>
      )}

      {/* 撤回提示（有可撤回批次时持久显示一个小入口） */}
      {lastBatch && !doneNotice && !loading && (
        <div className="mx-6 mt-3 shrink-0 text-12 text-ink-600">
          可 <button onClick={undoLastBatch} className="text-accent-dark underline" title="删除本批文档并恢复碎片">撤回上次织造</button>（{lastBatch.docIds.length} 篇 · {lastBatch.fragmentIds.length} 条碎片）
        </div>
      )}

      {error && (
        <div className="ww-error mx-6 mt-3 shrink-0 text-13">
          {error}
          {error.includes("API Key") || error.includes("未配置") ? (
            <Link href="/settings" className="ml-2 underline">去设置</Link>
          ) : null}
        </div>
      )}

      {/* 编辑器 */}
      <div className="ww-card mx-6 mb-6 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 px-5 pt-3">
          <label htmlFor="doc-title" className="sr-only">文档标题</label>
          <input
            id="doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="未命名文档"
            className="ww-title-input"
          />
          <div className="ml-auto flex items-center gap-2 pb-1">
            {lastMeta && (
              <span className="hidden text-11 text-ink-600 sm:inline">
                {lastMeta.provider} / {lastMeta.model}
                {lastMeta.elapsed ? ` · ${(lastMeta.elapsed / 1000).toFixed(1)}s` : ""}
              </span>
            )}
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="ww-btn ww-btn-ghost text-12"
              title="切换预览"
              aria-pressed={showPreview}
            >
              {showPreview ? <IconEdit /> : <IconEye />}
              {showPreview ? "仅编辑" : "编辑+预览"}
            </button>
          </div>
        </div>

        {/* 来源碎片（recognition over recall）：呈现这篇用了哪些 */}
        {sourceFragments.length > 0 && (
          <div className="shrink-0 border-b border-ink-200 px-5 py-2">
            <div className="text-11 text-ink-600 mb-1">这篇文档织自 {sourceFragments.length} 条碎片：</div>
            <div className="flex flex-wrap gap-1.5">
              {sourceFragments.slice(0, 6).map((f) => (
                <span key={f.id} className="ww-pill" title={f.content}>{f.content.slice(0, 16)}{f.content.length > 16 ? "…" : ""}</span>
              ))}
              {sourceFragments.length > 6 && <span className="ww-pill">+{sourceFragments.length - 6}</span>}
            </div>
          </div>
        )}

        <div className={`grid min-h-0 flex-1 ${showPreview ? "grid-cols-2" : "grid-cols-1"}`}>
          <div className={showPreview ? "border-r border-ink-200" : ""}>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="点上方「一键自动织造」，或在此直接用 Markdown 撰写…"
              className="h-full w-full resize-none bg-transparent p-5 font-mono text-13 leading-relaxed text-ink-900 outline-none"
            />
          </div>
          {showPreview && (
            <div className="min-h-0 overflow-y-auto p-5">
              {markdown ? (
                <MarkdownPreview md={markdown} />
              ) : (
                <EmptyState icon={<IconDoc />} title="预览将出现在这里" desc="织造成文档后，右侧实时渲染" />
              )}
            </div>
          )}
        </div>

        {(markdown || title) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 py-2.5 border-t border-ink-200">
            <button onClick={persistDoc} className="ww-btn ww-btn-ghost text-13">
              <IconSave /> 保存到本地
            </button>
            <ExportButtons title={title || "未命名文档"} markdown={markdown} />
            <SyncButton
              title={title || "未命名文档"}
              markdown={markdown}
              onSynced={(info) => {
                if (docId) {
                  saveDoc({
                    id: docId, title, markdown,
                    sourceFragmentIds: sourceFragments.map((f) => f.id),
                    createdAt: Date.now(), updatedAt: Date.now(),
                    sync: { provider: "feishu", remoteUrl: info.url, remoteToken: info.token, status: "synced", syncedAt: Date.now() },
                  });
                }
              }}
            />
          </div>
        )}
      </div>

      <ClassifyConfirm
        open={classifyOpen}
        groups={classifyGroups}
        previewMap={classifyPreviewMap}
        busy={classifyBusy || loading}
        onConfirm={confirmClassify}
        onCancel={() => setClassifyOpen(false)}
      />
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="ww-empty py-10">
      <div className="ww-empty-icon">{icon}</div>
      <div className="ww-empty-title">{title}</div>
      <div className="ww-empty-desc">{desc}</div>
    </div>
  );
}
function IconLoom() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16M4 5l3 14h10l3-14M9 12c1.5-2 4.5-2 6 0" /></svg>; }
function IconPlus() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>; }
function IconSave() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>; }
function IconEdit() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>; }
function IconEye() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>; }
function IconDoc() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>; }
function IconCheck() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>; }
