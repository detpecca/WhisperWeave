import { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { addFragment, listFragments, importWorkspace, isValidSnapshot } from "./src/lib/storage";
import type { Fragment } from "@whisperweave/core";

export default function App() {
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [draft, setDraft] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const list = await listFragments();
    setFragments(list);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const submit = async () => {
    const c = draft.trim();
    if (!c) return;
    await addFragment(c, tag);
    setDraft("");
    setTag("");
    await refresh();
  };

  const onImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const file = res.assets[0];
      const text = await FileSystem.readAsStringAsync(file.uri);
      const obj = JSON.parse(text);
      if (!isValidSnapshot(obj)) {
        Alert.alert("导入失败", "文件格式不正确，不是有效的工作区备份");
        return;
      }
      const snap = obj as any;
      Alert.alert(
        "选择导入模式",
        `检测到 ${snap.fragments.length} 条碎片、${snap.docs.length} 篇文档。\n\n确定 = 合并到现有数据\n取消 = 替换现有数据`,
        [
          { text: "取消", onPress: () => doImport(snap, "replace") },
          { text: "确定", onPress: () => doImport(snap, "merge") },
        ]
      );
    } catch (e) {
      Alert.alert("导入失败", e instanceof Error ? e.message : String(e));
    }
  };

  const doImport = async (snap: any, mode: "merge" | "replace") => {
    try {
      setLoading(true);
      const result = await importWorkspace(snap, mode);
      await refresh();
      Alert.alert(
        "导入成功",
        `${mode === "merge" ? "合并" : "替换"}：${result.fragments} 条碎片、${result.docs} 篇文档`
      );
    } catch (e) {
      Alert.alert("导入失败", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WhisperWeave</Text>
        <Text style={styles.subtitle}>碎片 → SQLite（阶段1 验证）</Text>
      </View>

      <View style={styles.inputCard}>
        <TextInput
          style={styles.contentInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="随手记一条碎片…"
          multiline
        />
        <View style={styles.row}>
          <TextInput
            style={styles.tagInput}
            value={tag}
            onChangeText={setTag}
            placeholder="标签（可选）"
          />
          <Pressable style={styles.btnPrimary} onPress={submit}>
            <Text style={styles.btnPrimaryText}>记下</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.toolbar}>
        <Text style={styles.count}>{fragments.length} 条碎片</Text>
        <Pressable style={styles.btnGhost} onPress={onImport}>
          <Text style={styles.btnGhostText}>导入 JSON</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={styles.loading} />
      ) : fragments.length === 0 ? (
        <Text style={styles.empty}>还没有碎片，先在上方记一条</Text>
      ) : (
        <FlatList
          data={fragments}
          keyExtractor={(item: Fragment) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }: { item: Fragment }) => (
            <View style={styles.fragItem}>
              <Text
                style={[
                  styles.fragContent,
                  item.consumed && styles.fragConsumed,
                ]}
              >
                {item.content}
              </Text>
              <View style={styles.fragMeta}>
                {item.tag ? <Text style={styles.fragTag}>{item.tag}</Text> : null}
                <Text style={styles.fragTime}>
                  {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                </Text>
                {item.consumed ? <Text style={styles.fragConsumedTag}>已织入</Text> : null}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const IVORY = "#f5f3ef";
const INK_900 = "#141413";
const INK_700 = "#5e5d59";
const INK_500 = "#87867f";
const ACCENT = "#b45309";
const BORDER = "#e8e6dc";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IVORY },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  title: { fontSize: 20, fontWeight: "700", color: INK_900 },
  subtitle: { fontSize: 12, color: INK_500, marginTop: 2 },
  inputCard: { margin: 16, padding: 12, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  contentInput: { minHeight: 80, fontSize: 14, color: INK_900, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  tagInput: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8, fontSize: 13, color: INK_900 },
  btnPrimary: { backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, justifyContent: "center" },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 8 },
  count: { fontSize: 13, color: INK_700, fontWeight: "600" },
  btnGhost: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  btnGhostText: { fontSize: 12, color: INK_700 },
  loading: { marginTop: 40 },
  empty: { textAlign: "center", color: INK_500, marginTop: 40, fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  fragItem: { padding: 12, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
  fragContent: { fontSize: 13, color: INK_900, lineHeight: 20 },
  fragConsumed: { color: INK_500, textDecorationLine: "line-through" },
  fragMeta: { flexDirection: "row", gap: 8, marginTop: 4, alignItems: "center" },
  fragTag: { fontSize: 11, color: INK_700, backgroundColor: "#f0eee6", paddingHorizontal: 9, paddingVertical: 2, borderRadius: 100 },
  fragTime: { fontSize: 11, color: INK_500 },
  fragConsumedTag: { fontSize: 11, color: ACCENT },
});
