import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "面试时间管理系统",
  description: "隐私隔离型中文版面试时间协调工具"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
