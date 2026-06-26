import type {
  AppSettings,
  Fragment,
  GeneratedDoc,
  ID,
  WorkspaceSnapshot,
} from "@whisperweave/core";
import { DEFAULT_SETTINGS } from "@whisperweave/core";
import {
  docToRow,
  fragmentToRow,
  getDb,
  loadSettingsRow,
  rowToDoc,
  rowToFragment,
  saveSettingsRow,
} from "./db";
import { loadSecrets, saveSecrets } from "./secure-store";

const uid = (): ID =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export async function listFragments(): Promise<Fragment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM fragments ORDER BY createdAt DESC"
  );
  return rows.map(rowToFragment);
}

export async function addFragment(
  content: string,
  tag?: string
): Promise<Fragment> {
  const db = await getDb();
  const now = Date.now();
  const f: Fragment = {
    id: uid(),
    content: content.trim(),
    tag: tag?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.runAsync(
    `INSERT INTO fragments (id, content, tag, createdAt, updatedAt, consumed, consumedByDocId)
     VALUES ($id, $content, $tag, $createdAt, $updatedAt, 0, NULL)`,
    {
      $id: f.id,
      $content: f.content,
      $tag: f.tag ?? null,
      $createdAt: f.createdAt,
      $updatedAt: f.updatedAt,
    }
  );
  return f;
}

export async function updateFragment(
  id: ID,
  patch: Partial<Fragment>
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM fragments WHERE id = ?",
    [id]
  );
  if (!existing) return;
  const merged = { ...rowToFragment(existing), ...patch, updatedAt: Date.now() };
  await db.runAsync(
    `UPDATE fragments SET content=$content, tag=$tag, updatedAt=$updatedAt,
     consumed=$consumed, consumedByDocId=$consumedByDocId WHERE id=$id`,
    {
      $id: id,
      $content: merged.content,
      $tag: merged.tag ?? null,
      $updatedAt: merged.updatedAt,
      $consumed: merged.consumed ? 1 : 0,
      $consumedByDocId: merged.consumedByDocId ?? null,
    }
  );
}

export async function deleteFragment(id: ID): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM fragments WHERE id = ?", [id]);
}

export async function clearFragments(): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM fragments");
}

export async function markFragmentsConsumed(
  ids: ID[],
  docId: ID
): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  for (const id of ids) {
    await db.runAsync(
      "UPDATE fragments SET consumed=1, consumedByDocId=? WHERE id=?",
      [docId, id]
    );
  }
}

export async function unmarkFragmentsConsumed(
  ids: ID[],
  docIds: ID[]
): Promise<void> {
  const db = await getDb();
  const fragSet = new Set(ids);
  const docSet = new Set(docIds);
  for (const id of fragSet) {
    await db.runAsync(
      "UPDATE fragments SET consumed=0, consumedByDocId=NULL WHERE id=? AND consumedByDocId IN (" +
        Array.from(docSet).map(() => "?").join(",") + ")",
      [id, ...Array.from(docSet)]
    );
  }
  for (const docId of docSet) {
    await db.runAsync("DELETE FROM docs WHERE id = ?", [docId]);
  }
}

export async function tagFragments(ids: ID[], tag: string): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const t = tag.trim();
  for (const id of ids) {
    await db.runAsync(
      "UPDATE fragments SET tag=?, updatedAt=? WHERE id=?",
      [t, Date.now(), id]
    );
  }
}

export async function listDocs(): Promise<GeneratedDoc[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM docs ORDER BY updatedAt DESC"
  );
  return rows.map(rowToDoc);
}

export async function getDoc(id: ID): Promise<GeneratedDoc | undefined> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM docs WHERE id = ?",
    [id]
  );
  return row ? rowToDoc(row) : undefined;
}

export async function saveDoc(doc: GeneratedDoc): Promise<void> {
  const db = await getDb();
  const r = docToRow(doc);
  await db.runAsync(
    `INSERT OR REPLACE INTO docs
     (id, title, markdown, sourceFragmentIds, createdAt, updatedAt, sync, archived)
     VALUES ($id, $title, $markdown, $sourceFragmentIds, $createdAt, $updatedAt, $sync, $archived)`,
    {
      $id: r.id,
      $title: r.title,
      $markdown: r.markdown,
      $sourceFragmentIds: r.sourceFragmentIds,
      $createdAt: r.createdAt,
      $updatedAt: r.updatedAt,
      $sync: r.sync,
      $archived: r.archived,
    }
  );
}

export async function deleteDoc(id: ID): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM docs WHERE id = ?", [id]);
}

export async function deleteDocs(ids: ID[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  for (const id of ids) {
    await db.runAsync("DELETE FROM docs WHERE id = ?", [id]);
  }
}

export async function archiveDocs(
  ids: ID[],
  archived: boolean
): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  for (const id of ids) {
    await db.runAsync(
      "UPDATE docs SET archived=?, updatedAt=? WHERE id=?",
      [archived ? 1 : 0, Date.now(), id]
    );
  }
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const stored = (await loadSettingsRow(db)) ?? {};
  const secrets = await loadSecrets();
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    llm: {
      ...DEFAULT_SETTINGS.llm,
      ...stored.llm,
      apiKey: secrets.llmApiKey || stored.llm?.apiKey,
    },
    feishu: {
      ...DEFAULT_SETTINGS.feishu,
      ...stored.feishu,
      appSecret: secrets.feishuAppSecret || stored.feishu?.appSecret,
    },
    presetTags:
      Array.isArray(stored.presetTags)
        ? stored.presetTags
        : DEFAULT_SETTINGS.presetTags,
  };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  const db = await getDb();
  await saveSecrets(s);
  const withoutSecrets: AppSettings = {
    ...s,
    llm: { ...s.llm, apiKey: undefined },
    feishu: { ...s.feishu, appSecret: undefined },
  };
  await saveSettingsRow(db, withoutSecrets);
}

export async function exportWorkspace(
  includeSecrets = false
): Promise<WorkspaceSnapshot> {
  const settings = await getSettings();
  const safeSettings: AppSettings = includeSecrets
    ? settings
    : {
        ...settings,
        llm: { ...settings.llm, apiKey: undefined },
        feishu: { ...settings.feishu, appSecret: undefined },
      };
  const [fragments, docs] = await Promise.all([listFragments(), listDocs()]);
  return {
    version: 1,
    exportedAt: Date.now(),
    source: "mobile",
    fragments,
    docs,
    settings: safeSettings,
    includeSecrets,
  };
}

export async function importWorkspace(
  snap: WorkspaceSnapshot,
  mode: "merge" | "replace"
): Promise<{ fragments: number; docs: number }> {
  if (!snap || snap.version !== 1) {
    throw new Error("无法识别的备份文件（version 不匹配）");
  }
  const db = await getDb();
  if (mode === "replace") {
    await db.runAsync("DELETE FROM fragments");
    await db.runAsync("DELETE FROM docs");
    for (const f of snap.fragments) {
      const r = fragmentToRow(f);
      await db.runAsync(
        `INSERT INTO fragments (id, content, tag, createdAt, updatedAt, consumed, consumedByDocId)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.content, r.tag, r.createdAt, r.updatedAt, r.consumed, r.consumedByDocId]
      );
    }
    for (const d of snap.docs) {
      const r = docToRow(d);
      await db.runAsync(
        `INSERT INTO docs (id, title, markdown, sourceFragmentIds, createdAt, updatedAt, sync, archived)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.title, r.markdown, r.sourceFragmentIds, r.createdAt, r.updatedAt, r.sync, r.archived]
      );
    }
    await saveSettings(snap.settings);
    return { fragments: snap.fragments.length, docs: snap.docs.length };
  }
  for (const f of snap.fragments) {
    const r = fragmentToRow(f);
    await db.runAsync(
      `INSERT OR REPLACE INTO fragments (id, content, tag, createdAt, updatedAt, consumed, consumedByDocId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.content, r.tag, r.createdAt, r.updatedAt, r.consumed, r.consumedByDocId]
    );
  }
  for (const d of snap.docs) {
    const r = docToRow(d);
    await db.runAsync(
      `INSERT OR REPLACE INTO docs (id, title, markdown, sourceFragmentIds, createdAt, updatedAt, sync, archived)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.title, r.markdown, r.sourceFragmentIds, r.createdAt, r.updatedAt, r.sync, r.archived]
    );
  }
  const current = await getSettings();
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
  await saveSettings(mergedSettings);
  return { fragments: snap.fragments.length, docs: snap.docs.length };
}

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
