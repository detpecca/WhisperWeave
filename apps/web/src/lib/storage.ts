import type { AppSettings, Fragment, GeneratedDoc, ID, WorkspaceSnapshot } from "@whisperweave/core";
import type { StorageAdapter } from "@whisperweave/core";

const KEY = {
  fragments: "ww.fragments",
  docs: "ww.docs",
  settings: "ww.settings",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

const uid = (): ID =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

// ---------------- Fragments ----------------

export function listFragments(): Fragment[] {
  return read<Fragment[]>(KEY.fragments, []).sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

export function addFragment(content: string, tag?: string): Fragment {
  const all = read<Fragment[]>(KEY.fragments, []);
  const now = Date.now();
  const f: Fragment = {
    id: uid(),
    content: content.trim(),
    tag: tag?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  write(KEY.fragments, [f, ...all]);
  return f;
}

export function updateFragment(id: ID, patch: Partial<Fragment>) {
  const all = read<Fragment[]>(KEY.fragments, []);
  const next = all.map((f) =>
    f.id === id ? { ...f, ...patch, updatedAt: Date.now() } : f
  );
  write(KEY.fragments, next);
}

export function deleteFragment(id: ID) {
  const all = read<Fragment[]>(KEY.fragments, []);
  write(
    KEY.fragments,
    all.filter((f) => f.id !== id)
  );
}

export function clearFragments() {
  write(KEY.fragments, []);
}

export function markFragmentsConsumed(ids: ID[], docId: ID) {
  const all = read<Fragment[]>(KEY.fragments, []);
  const set = new Set(ids);
  write(
    KEY.fragments,
    all.map((f) =>
      set.has(f.id)
        ? { ...f, consumed: true, consumedByDocId: docId }
        : f
    )
  );
}

/** 撤回一次织造批次：把指定碎片 un-consume，并删除它们生成的文档。
 * 用于「撤回这次织造」——让用户在不喜欢 LLM 产出时能一键恢复原料。 */
export function unmarkFragmentsConsumed(ids: ID[], docIds: ID[]) {
  const fragSet = new Set(ids);
  const docSet = new Set(docIds);
  // 1) un-consume 碎片（只清掉属于本批次的 consumedByDocId）
  write(
    KEY.fragments,
    read<Fragment[]>(KEY.fragments, []).map((f) =>
      fragSet.has(f.id) && docSet.has(f.consumedByDocId ?? "")
        ? { ...f, consumed: false, consumedByDocId: undefined, updatedAt: Date.now() }
        : f
    )
  );
  // 2) 删除本批次文档
  write(
    KEY.docs,
    read<GeneratedDoc[]>(KEY.docs, []).filter((d) => !docSet.has(d.id))
  );
}

/** 给一批碎片批量打上标签（用于分类确认后回填）。 */
export function tagFragments(ids: ID[], tag: string) {
  const all = read<Fragment[]>(KEY.fragments, []);
  const set = new Set(ids);
  write(
    KEY.fragments,
    all.map((f) =>
      set.has(f.id)
        ? { ...f, tag: tag.trim() || f.tag, updatedAt: Date.now() }
        : f
    )
  );
}

// ---------------- Docs ----------------

export function listDocs(): GeneratedDoc[] {
  return read<GeneratedDoc[]>(KEY.docs, []).sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
}

export function getDoc(id: ID): GeneratedDoc | undefined {
  return read<GeneratedDoc[]>(KEY.docs, []).find((d) => d.id === id);
}

export function saveDoc(doc: GeneratedDoc) {
  const all = read<GeneratedDoc[]>(KEY.docs, []);
  const idx = all.findIndex((d) => d.id === doc.id);
  const now = Date.now();
  const next = { ...doc, updatedAt: now };
  if (idx >= 0) {
    all[idx] = next;
  } else {
    all.unshift({ ...next, createdAt: now });
  }
  write(KEY.docs, all);
}

export function deleteDoc(id: ID) {
  write(
    KEY.docs,
    read<GeneratedDoc[]>(KEY.docs, []).filter((d) => d.id !== id)
  );
}

/** 批量删除文档。 */
export function deleteDocs(ids: ID[]) {
  const set = new Set(ids);
  write(
    KEY.docs,
    read<GeneratedDoc[]>(KEY.docs, []).filter((d) => !set.has(d.id))
  );
}

/** 批量归档/取消归档。 */
export function archiveDocs(ids: ID[], archived: boolean) {
  const set = new Set(ids);
  write(
    KEY.docs,
    read<GeneratedDoc[]>(KEY.docs, []).map((d) =>
      set.has(d.id) ? { ...d, archived, updatedAt: Date.now() } : d
    )
  );
}

// ---------------- Settings ----------------

export const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    provider: "deepseek",
    model: "deepseek-chat",
  },
  feishu: {},
  presetTags: ["工作", "灵感", "待办", "学习", "生活", "技术笔记"],
};

export function getSettings(): AppSettings {
  const stored = read<Partial<AppSettings>>(KEY.settings, {});
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    llm: {
      ...DEFAULT_SETTINGS.llm,
      ...stored.llm,
    },
    feishu: {
      ...DEFAULT_SETTINGS.feishu,
      ...stored.feishu,
    },
    presetTags:
      Array.isArray(stored.presetTags) && stored.presetTags.length >= 0
        ? stored.presetTags
        : DEFAULT_SETTINGS.presetTags,
  };
}

export function saveSettings(s: AppSettings) {
  write(KEY.settings, s);
}

// ---------------- 工作区导出/导入 ----------------

/** 导出工作区快照。
 * - includeSecrets=false（默认）：settings 里的 apiKey / 飞书 appSecret 清空，
 *   日常备份可安全分享；导出文件名标"不含密钥"。
 * - includeSecrets=true：保留密钥，仅用于自己换设备迁移，文件名标"含凭证"。
 */
export function exportWorkspace(includeSecrets = false): WorkspaceSnapshot {
  const settings = getSettings();
  const safeSettings: AppSettings = includeSecrets
    ? settings
    : {
        ...settings,
        llm: { ...settings.llm, apiKey: undefined },
        feishu: { ...settings.feishu, appSecret: undefined },
      };
  return {
    version: 1,
    exportedAt: Date.now(),
    source: "web",
    fragments: read<Fragment[]>(KEY.fragments, []),
    docs: read<GeneratedDoc[]>(KEY.docs, []),
    settings: safeSettings,
    includeSecrets,
  };
}

/** 导入模式：
 * - "merge"：保留现有数据，按 id 合并（快照里的覆盖同 id 的本地项，新 id 追加）。
 * - "replace"：清空本地全部数据，用快照整体替换。
 */
export type ImportMode = "merge" | "replace";

export function importWorkspace(
  snap: WorkspaceSnapshot,
  mode: ImportMode
): { fragments: number; docs: number } {
  if (!snap || snap.version !== 1) {
    throw new Error("无法识别的备份文件（version 不匹配）");
  }
  if (mode === "replace") {
    write(KEY.fragments, snap.fragments);
    write(KEY.docs, snap.docs);
    write(KEY.settings, snap.settings);
    return {
      fragments: snap.fragments.length,
      docs: snap.docs.length,
    };
  }
  // merge：按 id 合并，快照优先（同 id 覆盖本地）
  const mergeById = <T extends { id: ID }>(local: T[], incoming: T[]): T[] => {
    const map = new Map(local.map((x) => [x.id, x]));
    for (const x of incoming) map.set(x.id, x);
    return Array.from(map.values());
  };
  const localFrags = read<Fragment[]>(KEY.fragments, []);
  const localDocs = read<GeneratedDoc[]>(KEY.docs, []);
  write(KEY.fragments, mergeById(localFrags, snap.fragments));
  write(KEY.docs, mergeById(localDocs, snap.docs));
  // settings：快照里有密钥就带过来，没有就保留本地现有的
  const current = getSettings();
  const mergedSettings: AppSettings = {
    ...snap.settings,
    llm: {
      ...snap.settings.llm,
      apiKey: snap.settings.llm.apiKey || current.llm.apiKey,
    },
    feishu: {
      ...snap.settings.feishu,
      appSecret: snap.settings.feishu.appSecret || current.feishu.appSecret,
    },
  };
  write(KEY.settings, mergedSettings);
  return {
    fragments: snap.fragments.length,
    docs: snap.docs.length,
  };
}

