import * as SecureStore from "expo-secure-store";
import type { AppSettings } from "@whisperweave/core";

const KEY_LLM_APIKEY = "secrets.llm.apiKey";
const KEY_FEISHU_SECRET = "secrets.feishu.appSecret";

export async function loadSecrets(): Promise<{
  llmApiKey?: string;
  feishuAppSecret?: string;
}> {
  const [llmApiKey, feishuAppSecret] = await Promise.all([
    SecureStore.getItemAsync(KEY_LLM_APIKEY),
    SecureStore.getItemAsync(KEY_FEISHU_SECRET),
  ]);
  return {
    llmApiKey: llmApiKey || undefined,
    feishuAppSecret: feishuAppSecret || undefined,
  };
}

export async function saveSecrets(s: AppSettings): Promise<void> {
  if (s.llm.apiKey) {
    await SecureStore.setItemAsync(KEY_LLM_APIKEY, s.llm.apiKey);
  } else {
    await SecureStore.deleteItemAsync(KEY_LLM_APIKEY);
  }
  if (s.feishu.appSecret) {
    await SecureStore.setItemAsync(KEY_FEISHU_SECRET, s.feishu.appSecret);
  } else {
    await SecureStore.deleteItemAsync(KEY_FEISHU_SECRET);
  }
}
