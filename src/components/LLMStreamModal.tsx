"use client";

import { useEffect, useRef, useState } from "react";

export interface StreamSegment {
  /** 段标题，例如 "分类" / "织造 · 工作" */
  label: string;
  /** 这一段已积累的原始文本 */
  text: string;
  /** 状态：pending(排队) / live(生成中) / done / error */
  status: "pending" | "live" | "done" | "error";
}

interface Props {
  open: boolean;
  segments: StreamSegment[];
  /** 总标题，默认 "LLM 思考过程" */
  title?: string;
  onClose: () => void;
}

/**
 * LLM 流式思考过程弹窗：居中模态，纸卡片语言。
 * - role=dialog / aria-modal / aria-labelledby
 * - Esc 关闭（仅在无 live 段时）
 * - 打开时焦点进弹窗、关闭时还原
 * - 多段（分类 / 逐组织造）分段展示，当前 live 段高亮
 * - 设计：象牙纸面底 + slate 文字，赭石只留给"生成中" pill，
 *   流式文本走等宽（代码语言），段标题走无衬线 label。
 */
export function LLMStreamModal({ open, segments, title, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closerRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const liveEndRef = useRef<HTMLDivElement>(null);

  const hasLive = segments.some((s) => s.status === "live");
  const closable = !hasLive;

  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const t = setTimeout(() => closerRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      prevFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closable) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closable, onClose]);

  // 简易焦点陷阱
  useEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

  // 自动滚到底部（live 段）
  useEffect(() => {
    if (open) liveEndRef.current?.scrollIntoView({ block: "end" });
  }, [segments, open]);

  if (!open) return null;

  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hasLive) return;
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,8,8,0.42)" }}
      onClick={onBackdrop}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stream-title"
        className="ww-fade ww-card flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between px-5 py-3 border-b border-ink-200">
          <div className="flex items-center gap-2">
            <h3 id="stream-title" className="font-serif text-16 font-semibold text-ink-900">
              {title ?? "LLM 思考过程"}
            </h3>
            {hasLive && (
              <span
                className="ww-pill flex items-center gap-1"
                style={{ background: "var(--c-ochre-tint)", color: "var(--c-ochre-deep)" }}
              >
                <Spinner /> 生成中
              </span>
            )}
          </div>
          <button
            ref={closerRef}
            onClick={onClose}
            disabled={hasLive}
            className="text-ink-400 hover:text-ink-900 disabled:text-cloud-light"
            aria-label="关闭"
            title={hasLive ? "生成中，暂不可关闭" : "关闭"}
          >
            <IconX />
          </button>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5"
          style={{ background: "var(--c-ivory-light)" }}
        >
          {segments.length === 0 ? (
            <div className="flex h-full items-center justify-center text-ink-400">
              <Spinner /> <span className="ml-2 text-12">等待模型响应…</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {segments.map((seg, i) => (
                <div key={i} className="flex flex-col">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span
                      className="text-11 font-medium"
                      style={{
                        color:
                          seg.status === "live"
                            ? "var(--c-ochre-deep)"
                            : seg.status === "error"
                            ? "var(--c-ochre-deep)"
                            : "var(--c-cloud-dark)",
                      }}
                    >
                      {seg.label}
                    </span>
                    {seg.status === "live" && <Spinner />}
                    {seg.status === "done" && <IconCheck />}
                    {seg.status === "error" && <span className="text-11" style={{ color: "var(--c-ochre-deep)" }}>失败</span>}
                    {seg.status === "pending" && <span className="text-11 text-ink-500">排队</span>}
                  </div>
                  <pre
                    className="m-0 whitespace-pre-wrap break-words rounded-DEFAULT p-3 font-mono text-12 leading-relaxed"
                    style={{
                      color: "var(--c-slate-medium)",
                      background: "var(--c-ivory-medium)",
                    }}
                  >
                    {seg.text || (seg.status === "live" ? "…" : "（空）")}
                  </pre>
                </div>
              ))}
              <div ref={liveEndRef} />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 px-5 py-3 border-t border-ink-200">
          <span className="text-11 text-ink-600">
            {hasLive ? "生成中" : `${segments.length} 段已完成`}
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={hasLive}
            className="ww-btn ww-btn-ghost text-13 disabled:bg-cloud-light disabled:text-ivory-light"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--c-cloud-dark)" }}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: "var(--c-ochre-deep)" }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
