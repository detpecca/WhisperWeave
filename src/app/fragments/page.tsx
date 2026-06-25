"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Fragment, GeneratedDoc } from "@/lib/types";
import {
  addFragment,
  clearFragments,
  deleteFragment,
  listDocs,
  listFragments,
} from "@/lib/storage";

export default function FragmentsPage() {
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [draft, setDraft] = useState("");
  const [draftTag, setDraftTag] = useState("");
  const [hideConsumed, setHideConsumed] = useState(false);
  const [docs, setDocs] = useState<GeneratedDoc[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(() => {
    let list = listFragments();
    if (hideConsumed) list = list.filter((f) => !f.consumed);
    setFragments(list);
    setDocs(listDocs());
  }, [hideConsumed]);

  useEffect(() => { refresh(); }, [refresh]);

  const onDraftKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submitDraft(); }
  };

  const submitDraft = () => {
    const c = draft.trim();
    if (!c) return;
    addFragment(c, draftTag);
    setDraft("");
    setDraftTag("");
    refresh();
    taRef.current?.focus();
  };

  const pending = fragments.filter((f) => !f.consumed).length;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {/* 标题区 */}
        <header className="flex items-end justify-between">
          <div>
            <h1 className="font-serif text-20 font-semibold text-ink-900">碎片</h1>
            <p className="text-12 text-ink-600 mt-0.5">随手记下，待织造成文</p>
          </div>
          <div className="flex items-center gap-3 text-12 text-ink-600">
            <span>{pending} 条待织</span>
            <Link href="/weave" className="ww-btn ww-btn-primary text-13">
              <IconLoom /> 去织造
            </Link>
          </div>
        </header>

        {/* 输入卡片 */}
        <div className="ww-card p-4">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onDraftKey}
            placeholder="随手记下一条碎碎念、想法、待办、笔记片段…（⌘/Ctrl+Enter 快速保存）"
            className="ww-input min-h-[96px] resize-y font-sans"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              value={draftTag}
              onChange={(e) => setDraftTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitDraft()}
              placeholder="标签（可选）"
              className="ww-input flex-1 text-13"
            />
            <button onClick={submitDraft} className="ww-btn ww-btn-primary text-13">
              <IconPlus /> 记下
            </button>
          </div>
        </div>

        {/* 碎片列表 */}
        <div className="ww-card overflow-hidden">
          <div className="flex shrink-0 items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-13 font-semibold text-ink-900">全部碎片</span>
              <span className="ww-pill">{fragments.length}</span>
            </div>
            <label className="flex cursor-pointer items-center gap-1 text-11 text-ink-600">
              <input
                type="checkbox"
                checked={hideConsumed}
                onChange={(e) => setHideConsumed(e.target.checked)}
                className="accent-accent"
              />
              隐藏已织
            </label>
          </div>
          <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
            {fragments.length === 0 ? (
              <EmptyState icon={<IconSpark />} title="还没有碎片" desc="先在上方记一条吧" />
            ) : (
              <ul>
                {fragments.map((f) => (
                  <li key={f.id} className="group mx-2 mb-1.5 rounded-DEFAULT px-3 py-2 transition-colors hover:bg-ink-50">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`whitespace-pre-wrap break-words text-13 leading-relaxed ${f.consumed ? "text-ink-600 line-through" : "text-ink-800"}`}>
                          {f.content}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {f.tag && <span className="ww-pill">{f.tag}</span>}
                          <span className="text-11 text-ink-600">
                            {new Date(f.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {f.consumed && <span className="text-11 text-accent">已织入</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => { deleteFragment(f.id); refresh(); }}
                        className="shrink-0 text-ink-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                        title="删除"
                      >
                        <IconX />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {fragments.length > 0 && (
            <div className="border-t border-ink-200 px-4 py-2">
              <button
                onClick={() => { if (confirm("确定清空全部碎片？不可撤销。")) { clearFragments(); refresh(); } }}
                className="text-11 text-ink-600 hover:text-red-500"
              >
                清空全部
              </button>
            </div>
          )}
        </div>

        {/* 已织文档快览 */}
        {docs.length > 0 && (
          <div className="ww-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-13 font-semibold text-ink-900">已织文档</span>
              <Link href="/docs" className="text-11 text-accent-dark hover:underline">全部 →</Link>
            </div>
            <ul className="max-h-[200px] overflow-y-auto">
              {docs.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link href={`/docs?id=${d.id}`} className="flex w-full items-center justify-between px-4 py-2 hover:bg-ink-50">
                    <span className="truncate text-13 text-ink-800">{d.title}</span>
                    <span className="ml-2 shrink-0 text-11 text-ink-600">
                      {new Date(d.updatedAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
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
function IconX() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function IconSpark() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>; }
