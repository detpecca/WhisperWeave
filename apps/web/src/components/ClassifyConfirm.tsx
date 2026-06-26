"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClassifyGroup } from "@whisperweave/core";

interface Props {
  open: boolean;
  groups: ClassifyGroup[];
  /** 分组名 → 碎片内容预览（用于展示每条归属） */
  previewMap: Record<string, string[]>;
  busy: boolean;
  onConfirm: (groups: ClassifyGroup[]) => void;
  onCancel: () => void;
}

/**
 * 分类确认弹窗：真 dialog 语义。
 * - role="dialog" / aria-modal / aria-labelledby
 * - Esc 关闭、点遮罩关闭
 * - 打开时焦点进弹窗、关闭时还原触发焦点
 * - busy 状态用 aria-live 播报
 */
export function ClassifyConfirm({
  open, groups, previewMap, busy, onConfirm, onCancel,
}: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const closerRef = useRef<HTMLButtonElement>(null);
  /** 记住打开瞬间的焦点元素，关闭后还原 */
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d: Record<string, string> = {};
    groups.forEach((g, i) => { d[key(g, i)] = g.tag; });
    setDraft(d);
  }, [groups]);

  // 打开时：记焦点 + 聚焦关闭键；关闭时还原
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    // 等一帧让 DOM 挂载
    const t = setTimeout(() => closerRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      prevFocusRef.current?.focus?.();
    };
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  // 简易焦点陷阱：Tab 在弹窗内循环
  useEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
  }, [open]);

  const newTagCount = useMemo(() => groups.filter((g) => g.isNewTag).length, [groups]);

  if (!open) return null;

  const confirm = () => {
    const merged: ClassifyGroup[] = groups.map((g, i) => ({
      ...g,
      tag: (draft[key(g, i)] ?? g.tag).trim() || g.tag,
    }));
    onConfirm(merged);
  };

  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (busy) return;
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onBackdrop}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="classify-title"
        aria-busy={busy || undefined}
        className="ww-fade ww-card max-h-[88vh] w-full max-w-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-200">
          <div>
            <h3 id="classify-title" className="font-serif text-16 font-semibold text-ink-900">分类预览</h3>
            <p className="mt-0.5 text-12 text-ink-600">
              共 {groups.length} 个分组 · {groups.reduce((n, g) => n + g.fragmentIds.length, 0)} 条碎片
              {newTagCount > 0 && <span className="ml-1 text-accent-dark">· 含 {newTagCount} 个新标签待确认</span>}
            </p>
          </div>
          <button
            ref={closerRef}
            onClick={onCancel}
            disabled={busy}
            className="text-ink-400 hover:text-ink-900 disabled:opacity-40"
            aria-label="关闭"
            title="关闭"
          >
            <IconX />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-13 text-ink-600">没有分组结果</p>
          ) : (
            <ul className="space-y-3">
              {groups.map((g, i) => {
                const k = key(g, i);
                const previews = previewMap[k] ?? [];
                return (
                  <li key={k} className="rounded-DEFAULT p-3" style={{ background: "var(--c-ivory-light)" }}>
                    <div className="flex flex-wrap items-center gap-2">
                      {g.isNewTag && (
                        <span className="ww-pill" style={{ background: "var(--c-ochre-tint)", color: "var(--c-ochre-deep)" }}>新标签</span>
                      )}
                      <input
                        value={draft[k] ?? g.tag}
                        onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                        disabled={busy}
                        className={`ww-input w-auto flex-1 !bg-white py-1 text-13 font-semibold ${g.isNewTag ? "!border-accent" : ""}`}
                        aria-label={`分组标签：${g.tag}`}
                      />
                      <span className="ww-pill">{g.fragmentIds.length} 条</span>
                    </div>
                    {g.reason && <p className="mt-1.5 text-11 text-ink-600">{g.reason}</p>}
                    <ul className="mt-2 space-y-1">
                      {previews.slice(0, 4).map((p, j) => (
                        <li key={j} className="truncate text-12 text-ink-700">· {p}</li>
                      ))}
                      {previews.length > 4 && <li className="text-11 text-ink-500">…还有 {previews.length - 4} 条</li>}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-ink-200">
          <button onClick={onCancel} disabled={busy} className="ww-btn ww-btn-ghost text-13">取消</button>
          <button
            onClick={confirm}
            disabled={busy || groups.length === 0}
            className="ww-btn ww-btn-primary text-13"
            aria-label={`确认并织造 ${groups.length} 篇文档`}
          >
            <IconLoom /> {busy ? "织造中…" : `确认并织造 ${groups.length} 篇`}
          </button>
        </div>
      </div>
    </div>
  );
}

function key(g: ClassifyGroup, i: number) { return `${i}-${g.tag}`; }
function IconX() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function IconLoom() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16M4 5l3 14h10l3-14M9 12c1.5-2 4.5-2 6 0" /></svg>; }
