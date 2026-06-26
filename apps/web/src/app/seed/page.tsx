"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "ww.fragments";
const MIN = 60 * 1000;

/**
 * 测试碎片种子：13 条，覆盖 工作/读书/技术/生活 四主题。
 * - 部分带预设标签（工作/待办/学习/技术笔记），测「复用已有标签」
 * - 部分无标签，测「LLM 自动按主题分类」
 * - 「读书」不在预设集合，会触发 isNewTag 确认流程（新标签高亮、可改名）
 * 期望分类结果：4 组（工作 4 / 读书 3 / 技术笔记 3 / 生活 3），多篇并行织造。
 */
const SEED: { content: string; tag?: string; agoMin: number }[] = [
  { content: "周会敲定 Q3 砍掉两个边缘功能，聚焦核心闭环，别再铺新摊子", tag: "工作", agoMin: 25 },
  { content: "客户反馈导出 PDF 乱码，本周必修，优先级提到 P1", tag: "待办", agoMin: 90 },
  { content: "回复张工邮件，确认下周排期和交付节点", tag: "待办", agoMin: 180 },
  { content: "团队 wiki 里有两个页面内容重复了，需要合并成一页", tag: "工作", agoMin: 320 },
  { content: "《思考快与慢》：系统一直觉判断常出错，重要决策要刻意切到系统二慢想，别急着拍板", agoMin: 600 },
  { content: "记一句话：「简洁是终极的成熟」，写文档和写代码时都默念一遍", agoMin: 720 },
  { content: "想写一篇关于注意力碎片化的读书笔记，周末动笔，先把骨架列出来", tag: "学习", agoMin: 900 },
  { content: "Next.js 15 的 Server Actions 真香，简单表单不用再单独写 API route 了", tag: "技术笔记", agoMin: 1200 },
  { content: "TypeScript 5.4 的 NoInfer 终于能约束泛型推断了，泛型函数的类型更稳", tag: "技术笔记", agoMin: 1500 },
  { content: "debug 半天发现是 useEffect 依赖数组漏了一项，低级错误，引以为戒", agoMin: 1800 },
  { content: "周末想去爬香山看红叶，查查天气和公交", agoMin: 2100 },
  { content: "最近睡眠不好，试试 11 点前关手机，卧室不放充电器", agoMin: 2400 },
  { content: "妈来电说家里桂花开了，满院子的香，想国庆回趟家", agoMin: 2880 },
];

interface SeedFrag { id: string; content: string; tag?: string; createdAt: number; updatedAt: number; }

export default function SeedPage() {
  const [msg, setMsg] = useState<string>("正在检查…");
  const [existing, setExisting] = useState(0);
  const [seeded, setSeeded] = useState(0);

  const check = () => {
    try {
      const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
      setExisting(arr.length);
      if (arr.length === 0) {
        doSeed(false);
      } else {
        setMsg(`已有 ${arr.length} 条碎片。可追加一批，或先去清空再重来。`);
      }
    } catch {
      setMsg("读取本地数据出错");
    }
  };

  const doSeed = (merge: boolean) => {
    const now = Date.now();
    const base = merge ? (JSON.parse(localStorage.getItem(KEY) || "[]") as SeedFrag[]) : [];
    const frags: SeedFrag[] = SEED.map((s, i) => {
      const t = now - s.agoMin * MIN;
      return { id: `seed-${t.toString(36)}-${i}`, content: s.content, tag: s.tag, createdAt: t, updatedAt: t };
    });
    localStorage.setItem(KEY, JSON.stringify([...frags, ...base]));
    setExisting(frags.length + base.length);
    setSeeded(frags.length);
    setMsg(merge ? `已追加 ${frags.length} 条，现在共 ${frags.length + base.length} 条。` : `已写入 ${frags.length} 条测试碎片。`);
  };

  useEffect(() => { check(); }, []);

  return (
    <div className="ww-bg-main flex h-full items-center justify-center p-6">
      <div className="ww-card w-full max-w-lg p-6 text-center">
        <div className="ww-empty-icon mx-auto mb-3" style={{ width: 48, height: 48 }}><IconSeed /></div>
        <h1 className="font-serif text-20 font-semibold text-ink-900">测试数据种子</h1>
        <p className="mt-2 text-13 text-ink-700">{msg}</p>

        {seeded > 0 && (
          <p className="mt-2 text-12 text-ink-600">
            覆盖 工作 / 读书 / 技术 / 生活 四主题，其中「读书」不在预设标签里，会触发新标签确认流程。
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link href="/fragments" className="ww-btn ww-btn-primary text-13">
            <IconList /> 去碎片页查看
          </Link>
          <Link href="/weave" className="ww-btn ww-btn-ghost text-13">
            <IconLoom /> 去织造页试跑
          </Link>
          {existing > 0 && (
            <button onClick={() => doSeed(true)} className="ww-btn ww-btn-ghost text-13">
              <IconPlus /> 再追加一批
            </button>
          )}
        </div>

        <p className="mt-4 text-11 text-ink-600">
          提示：这是开发用种子页，正式使用时可删除 <code className="rounded-DEFAULT px-1" style={{ background: "var(--c-ivory-medium)" }}>src/app/seed/page.tsx</code>。
        </p>
      </div>
    </div>
  );
}

function IconSeed() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>; }
function IconList() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>; }
function IconLoom() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16M4 5l3 14h10l3-14M9 12c1.5-2 4.5-2 6 0" /></svg>; }
function IconPlus() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>; }
