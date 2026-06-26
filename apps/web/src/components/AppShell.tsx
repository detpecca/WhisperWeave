"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/fragments", label: "碎片", icon: <IconSpark /> },
  { href: "/weave", label: "织造", icon: <IconLoom /> },
  { href: "/docs", label: "文档", icon: <IconDoc /> },
  { href: "/settings", label: "设置", icon: <IconSettings /> },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-screen">
      {/* 左侧导航 */}
      <nav className="ww-bg-sidebar flex w-[200px] shrink-0 flex-col border-r border-ink-200">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <Logo />
          <div>
            <div className="font-serif text-16 font-semibold leading-tight text-ink-900">
              WhisperWeave
            </div>
            <div className="text-11 text-ink-600 -mt-0.5">絮语 · 织</div>
          </div>
        </div>
        <ul className="mt-2 flex flex-col gap-0.5 px-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-DEFAULT px-3 py-2 text-13 font-medium transition-colors ${
                    active
                      ? "bg-ink-200 text-ink-900"
                      : "text-ink-700 hover:bg-ink-100"
                  }`}
                >
                  <span className={active ? "text-accent" : "text-ink-600"}>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto px-4 py-3 text-11 text-ink-600">
          v0.1 · 本地优先
        </div>
      </nav>
      {/* 右侧内容 */}
      <main className="ww-bg-main min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-card bg-accent text-white shadow-card">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M4 5h16M4 5l3 14h10l3-14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12c1.5-2 4.5-2 6 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function IconSpark() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>;
}
function IconLoom() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16M4 5l3 14h10l3-14M9 12c1.5-2 4.5-2 6 0" /></svg>;
}
function IconDoc() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>;
}
function IconSettings() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>;
}
