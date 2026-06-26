import type { Config } from "tailwindcss";

const config: Config = {
  content: [
      "./src/**/*.{js,ts,jsx,tsx,mdx}",
      "../../packages/core/src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
  theme: {
    extend: {
      colors: {
        // Claude / Anthropic 色板（取自 anthropic.com 品牌令牌）
        ink: {
          50: "#faf9f5", // ivory-light  侧边栏底
          100: "#f5f3ef", // paper        主区域底
          200: "#f0eee6", // ivory-medium
          300: "#e8e6dc", // ivory-dark   分隔/描边(极少用)
          400: "#d1cfc5", // cloud-light
          500: "#b0aea5", // cloud-medium
          600: "#87867f", // cloud-dark   次要文字
          700: "#5e5d59", // slate-light
          800: "#3d3d3a", // slate-medium
          900: "#141413", // slate-dark   正文/近黑
          950: "#080808",
        },
        accent: {
          DEFAULT: "#b45309", // ochre  赭石品牌色
          dark: "#92400e",    // 深赭石  悬停/按下
          soft: "#ebcece",    // coral  软底
          tint: "#f5e3c7",    // manilla 淡黄
        },
      },
      fontFamily: {
        // UI 文字、按钮、标签用 Switzer（几何无衬线，Fontshare，替代过度使用的 Inter）
        sans: [
          "Switzer",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
        // 标题、文档正文用衬线（Anthropic Serif 的免费近似：Newsreader）
        serif: [
          "Newsreader",
          "Anthropic Serif",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        // 六级字号
        "11": ["0.6875rem", { lineHeight: "1rem" }],
        "12": ["0.75rem", { lineHeight: "1.05rem" }],
        "13": ["0.8125rem", { lineHeight: "1.2rem" }],
        "14": ["0.875rem", { lineHeight: "1.35rem" }],
        "16": ["1rem", { lineHeight: "1.5rem" }],
        "20": ["1.25rem", { lineHeight: "1.7rem" }],
      },
      borderRadius: {
        // 三档圆角
        pill: "100vw",
        small: "4px",
        DEFAULT: "8px",
        card: "12px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
