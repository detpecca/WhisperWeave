import type { AppSettings, Fragment, GeneratedDoc, ID, WorkspaceSnapshot } from "./types";

/**
 * 存储适配器：抽象掉底层持久化差异。
 * - web 实现：localStorage（见 apps/web/src/lib/storage.ts）
 * - mobile 实现：expo-sqlite + expo-secure-store（见 apps/mobile）
 *
 * 之所以抽接口：web 用 localStorage、mobile 用 SQLite，但上层逻辑
 * （碎片增删、文档管理、设置、备份导出）完全一样，不该关心存哪。
 */
export interface StorageAdapter {
  // ---- Fragments ----
  listFragments(): Fragment[];
  addFragment(content: string, tag?: string): Fragment;
  updateFragment(id: ID, patch: Partial<Fragment>): void;
  deleteFragment(id: ID): void;
  clearFragments(): void;
  markFragmentsConsumed(ids: ID[], docId: ID): void;
  unmarkFragmentsConsumed(ids: ID[], docIds: ID[]): void;
  tagFragments(ids: ID[], tag: string): void;

  // ---- Docs ----
  listDocs(): GeneratedDoc[];
  getDoc(id: ID): GeneratedDoc | undefined;
  saveDoc(doc: GeneratedDoc): void;
  deleteDoc(id: ID): void;
  deleteDocs(ids: ID[]): void;
  archiveDocs(ids: ID[], archived: boolean): void;

  // ---- Settings ----
  getSettings(): AppSettings;
  saveSettings(s: AppSettings): void;

  // ---- 工作区备份 ----
  exportWorkspace(includeSecrets?: boolean): WorkspaceSnapshot;
  importWorkspace(
    snap: WorkspaceSnapshot,
    mode: "merge" | "replace"
  ): { fragments: number; docs: number };
}

/** 校验未知对象是否是合法快照（导入前预检，与存储实现无关）。 */
export function isValidSnapshot(obj: unknown): obj is WorkspaceSnapshot {
  if (!obj || typeof obj !== "object") return false;
  const s = obj as Record<string, unknown>;
  return (
    s.version === 1 &&
    Array.isArray(s.fragments) &&
    Array.isArray(s.docs) &&
    typeof s.settings === "object" &&
    s.settings !== null
  );
}
