"use client";

import { useRef, useState } from "react";
import {
  exportWorkspace,
  getSettings,
  importWorkspace,
  saveSettings,
} from "@/lib/storage";
import type { AppSettings, LLMProvider, WorkspaceSnapshot } from "@whisperweave/core";
import { isValidSnapshot, PROVIDER_DEFAULTS } from "@whisperweave/core";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [saved, setSaved] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [workspaceMsg, setWorkspaceMsg] = useState<string | null>(null);
  const [exportIncludeSecrets, setExportIncludeSecrets] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setSaved(false);
  };
  const updateLLM = (patch: Partial<AppSettings["llm"]>) => {
    setSettings((s) => ({ ...s, llm: { ...s.llm, ...patch } }));
    setSaved(false);
  };
  const updateFeishu = (patch: Partial<AppSettings["feishu"]>) => {
    setSettings((s) => ({ ...s, feishu: { ...s.feishu, ...patch } }));
    setSaved(false);
  };
  const onProviderChange = (provider: LLMProvider) => {
    const def = PROVIDER_DEFAULTS[provider];
    updateLLM({ provider, model: def.model, baseUrl: def.baseUrl });
  };
  const save = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const addPresetTag = () => {
    const t = newTag.trim();
    if (!t) return;
    if (settings.presetTags.includes(t)) { setNewTag(""); return; }
    update({ presetTags: [...settings.presetTags, t] });
    setNewTag("");
  };
  const removePresetTag = (tag: string) => {
    update({ presetTags: settings.presetTags.filter((t) => t !== tag) });
  };

  // ---- 工作区导出/导入 ----
  const safeName = (s: string) =>
    s.replace(/[#<>:"/\\|?*\n\r\t]/g, "").trim() || "WhisperWeave";

  const onExport = () => {
    const snap = exportWorkspace(exportIncludeSecrets);
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const tag = exportIncludeSecrets ? "含凭证" : "不含密钥";
    const filename = `WhisperWeave-${stamp}-${tag}.json`;
    const blob = new Blob([JSON.stringify(snap, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setWorkspaceMsg(
      `已导出 ${snap.fragments.length} 条碎片、${snap.docs.length} 篇文档${
        exportIncludeSecrets ? "（含凭证，请妥善保管）" : "（不含密钥）"
      }`
    );
  };

  const onImportFile = async (file: File) => {
    setImportBusy(true);
    setWorkspaceMsg(null);
    try {
      const text = await file.text();
      const obj = JSON.parse(text) as unknown;
      if (!isValidSnapshot(obj)) {
        throw new Error("文件格式不正确，不是有效的工作区备份");
      }
      const snap = obj as WorkspaceSnapshot;
      const mode: "merge" | "replace" = window.confirm(
        `检测到 ${snap.fragments.length} 条碎片、${snap.docs.length} 篇文档。\n\n` +
          "确定 = 合并到现有数据（同 id 覆盖，新 id 追加）\n" +
          "取消 = 替换现有数据（先清空本地全部，再导入）"
      )
        ? "merge"
        : "replace";
      const result = importWorkspace(snap, mode);
      setSettings(getSettings());
      setWorkspaceMsg(
        `已导入（${mode === "merge" ? "合并" : "替换"}）：${result.fragments} 条碎片、${result.docs} 篇文档`
      );
    } catch (e) {
      setWorkspaceMsg(
        `导入失败：${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setImportBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const def = PROVIDER_DEFAULTS[settings.llm.provider] ?? PROVIDER_DEFAULTS["openai-compatible"];
  const isOAICompat = settings.llm.provider !== "anthropic";

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <header className="mb-1">
          <h1 className="font-serif text-20 font-semibold text-ink-900">设置</h1>
          <p className="text-12 text-ink-600 mt-0.5">模型、飞书同步、预设标签</p>
        </header>

        {/* LLM */}
        <section className="ww-card p-4">
          <h2 className="mb-3 text-12 font-semibold uppercase tracking-wide text-ink-600">LLM 模型</h2>
          <label className="mb-1 block text-13 text-ink-800">提供商</label>
          <select
            value={settings.llm.provider}
            onChange={(e) => onProviderChange(e.target.value as LLMProvider)}
            className="ww-input mb-3"
          >
            <option value="deepseek">DeepSeek（默认，国内稳定）</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic Claude</option>
            <option value="qwen">通义千问</option>
            <option value="zhipu">智谱 GLM</option>
            <option value="openai-compatible">OpenAI 兼容（自定义 baseURL）</option>
          </select>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-13 text-ink-800">模型</label>
              <input
                value={settings.llm.model}
                onChange={(e) => updateLLM({ model: e.target.value })}
                placeholder={def.model || "模型名"}
                className="ww-input"
              />
            </div>
            {isOAICompat && (
              <div>
                <label className="mb-1 block text-13 text-ink-800">Base URL</label>
                <input
                  value={settings.llm.baseUrl ?? ""}
                  onChange={(e) => updateLLM({ baseUrl: e.target.value })}
                  placeholder={def.baseUrl || "https://api…/v1"}
                  className="ww-input"
                />
              </div>
            )}
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-13 text-ink-800">
              API Key
              <span className="ml-1 text-11 text-ink-600">（仅存浏览器本地，调用时经服务端转发）</span>
            </label>
            <input
              type="password"
              value={settings.llm.apiKey ?? ""}
              onChange={(e) => updateLLM({ apiKey: e.target.value })}
              placeholder="sk-…"
              className="ww-input"
            />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-13 text-ink-800">
              织造附加指令
              <span className="ml-1 text-11 text-ink-600">（可选）</span>
            </label>
            <textarea
              value={settings.customInstruction ?? ""}
              onChange={(e) => update({ customInstruction: e.target.value })}
              placeholder="例如：语言风格更简洁；必须包含小标题；面向团队周会汇报…"
              className="ww-input min-h-[64px]"
            />
          </div>
        </section>

        {/* 预设标签 */}
        <section className="ww-card p-4">
          <h2 className="mb-1 text-12 font-semibold uppercase tracking-wide text-ink-600">预设标签集合</h2>
          <p className="mb-3 text-11 text-ink-600">
            自动织造分类时，LLM 会优先从这些标签里挑选；遇到预设里没有的主题，会新建标签并在弹窗里标红等你确认，确认后自动并入此处。
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {settings.presetTags.length === 0 && (
              <span className="text-11 text-ink-500">还没有预设标签</span>
            )}
            {settings.presetTags.map((tag) => (
              <span key={tag} className="ww-pill group">
                {tag}
                <button
                  onClick={() => removePresetTag(tag)}
                  className="ml-0.5 text-ink-500 hover:text-red-500"
                  title="移除"
                >
                  <IconXSmall />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPresetTag()}
              placeholder="新增一个预设标签"
              className="ww-input flex-1"
            />
            <button onClick={addPresetTag} className="ww-btn ww-btn-ghost text-13">
              <IconPlus /> 添加
            </button>
          </div>
        </section>

        {/* 飞书 */}
        <section className="ww-card p-4">
          <h2 className="mb-1 text-12 font-semibold uppercase tracking-wide text-ink-600">飞书云文档同步</h2>
          <p className="mb-3 text-11 text-ink-600">
            在飞书开放平台创建「自建应用」，开启「云文档」相关权限（docx:document、drive:drive、drive:file 等），把 App ID / Secret 填入下方。
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-13 text-ink-800">App ID</label>
              <input
                value={settings.feishu.appId ?? ""}
                onChange={(e) => updateFeishu({ appId: e.target.value })}
                placeholder="cli_xxxxxxxx"
                className="ww-input"
              />
            </div>
            <div>
              <label className="mb-1 block text-13 text-ink-800">App Secret</label>
              <input
                type="password"
                value={settings.feishu.appSecret ?? ""}
                onChange={(e) => updateFeishu({ appSecret: e.target.value })}
                className="ww-input"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-13 text-ink-800">
              目标文件夹 token
              <span className="ml-1 text-11 text-ink-600">（留空则存到云空间根目录）</span>
            </label>
            <input
              value={settings.feishu.folderToken ?? ""}
              onChange={(e) => updateFeishu({ folderToken: e.target.value })}
              placeholder="fldr…"
              className="ww-input"
            />
          </div>
        </section>

        {/* 工作区备份 */}
        <section className="ww-card p-4">
          <h2 className="mb-1 text-12 font-semibold uppercase tracking-wide text-ink-600">工作区备份</h2>
          <p className="mb-3 text-11 text-ink-600">
            导出包含所有碎片、文档与配置的 JSON 文件，用于备份或迁移到其他设备。默认不含 API Key 与飞书 App Secret，可安全分享；换设备迁移时勾选「包含凭证」。
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-12 text-ink-700">
              <input
                type="checkbox"
                checked={exportIncludeSecrets}
                onChange={(e) => setExportIncludeSecrets(e.target.checked)}
                className="accent-accent"
              />
              包含凭证（含 API Key 与飞书 Secret，仅自己保管）
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onExport} className="ww-btn ww-btn-ghost text-13">
              <IconDownload /> 导出工作区
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy}
              className="ww-btn ww-btn-ghost text-13 disabled:bg-cloud-light disabled:text-ivory-light"
            >
              <IconUpload /> {importBusy ? "导入中…" : "导入工作区"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportFile(f);
              }}
            />
          </div>
          {workspaceMsg && (
            <p className="mt-3 text-12 text-ink-700">{workspaceMsg}</p>
          )}
        </section>

        <div className="flex items-center gap-3 pb-4">
          <button onClick={save} className="ww-btn ww-btn-primary text-13">
            <IconSave /> 保存设置
          </button>
          {saved && <span className="text-13 text-green-600">已保存</span>}
          <span className="ml-auto text-11 text-ink-600">所有配置仅保存在本地浏览器。</span>
        </div>
      </div>
    </div>
  );
}
function IconSave() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>; }
function IconPlus() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>; }
function IconXSmall() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function IconDownload() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>; }
function IconUpload() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>; }
