import type { AppSettings, Fragment, GeneratedDoc, ID } from "./types";

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
